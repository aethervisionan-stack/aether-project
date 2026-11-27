/**
 * Headless smoke: post-payment / F5 session restore must never dump on landing.
 * Run: npx tsx scripts/smoke-iq-session-restore.ts
 */
import {
  coerceQuizSnapshot,
  createInitialState,
  findQuizStateBySessionId,
  findResumableQuizState,
  quizStateActivityAt,
  saveQuizState,
  clearQuizState,
} from "../src/lib/quizStorage";
import {
  cleanIqPaymentReturnUrl,
  createIqSessionId,
  ensureIqSessionIdInUrl,
  extractIqSessionIdFromOrderNsu,
  readIqPaymentReturnParams,
} from "../src/lib/iqUnlockClient";
import type { IqResult, QuizPersistedState } from "../src/types/quiz";
import { QUIZ_STORAGE_VERSION } from "../src/types/quiz";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Minimal in-memory localStorage for Node smoke. */
function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { localStorage?: typeof storage }).localStorage = storage;
  (globalThis as { window?: { localStorage: typeof storage } }).window = {
    localStorage: storage,
  };
  return storage;
}

function stubResult(): IqResult {
  return {
    mode: "figures",
    rawScore: 20,
    maxScore: 30,
    accuracy: 0.66,
    iq: 112,
    theta: 0.4,
    marginOfError: 6,
    confidenceMargin: 6,
    consistencyScore: 80,
    iqLow: 106,
    iqHigh: 118,
    percentile: 78,
    band: "Acima da média",
    competences: {
      spatial: 110,
      boolean: 108,
      pattern: 112,
      numerical: 111,
      logical: 109,
      numeric: 110,
      verbal: 107,
      analytical: 108,
    },
    activeCompetences: ["spatial", "pattern"],
    indexScores: [],
    subtestScores: [],
    anomalies: {
      flags: [],
      guessingLikely: false,
      fatigueLikely: false,
      inconsistencyLikely: false,
    },
    cognitiveProfile: {
      summary: "ok",
      strengths: [],
      improvements: [],
    },
    avgTimeMs: 12_000,
    timeMetrics: {
      meanMs: 12_000,
      medianMs: 11_000,
      p90Ms: 20_000,
      rushCount: 0,
      slowCount: 0,
    },
    answers: [],
    diagnosis: {
      consistencyScore: 80,
      reliabilityLabel: "Alta",
      notes: [],
    },
  } as unknown as IqResult;
}

function finishedState(
  mode: "figures" | "questions" | "hybrid",
  sessionId: string,
  finishedAt: number,
): QuizPersistedState {
  const base = createInitialState(mode, 30, "Restore QA", null, 42);
  return {
    ...base,
    version: QUIZ_STORAGE_VERSION,
    phase: "results",
    startedAt: finishedAt - 600_000,
    endsAt: finishedAt + 1000,
    finishedAt,
    result: { ...stubResult(), mode },
    sessionId,
    resultsUnlocked: false,
    unlockOrderNsu: null,
    answers: Array(30).fill(0),
    timeSpentMs: Array(30).fill(10_000),
    optionSwitches: Array(30).fill(0),
  };
}

function main() {
  installMemoryStorage();
  clearQuizState();

  const sid = createIqSessionId();
  assert(sid.startsWith("iq_"), "session id prefix");

  const older = finishedState("questions", createIqSessionId(), 1_000);
  const newer = finishedState("figures", sid, 2_000);
  saveQuizState(older);
  saveQuizState(newer);

  assert(quizStateActivityAt(newer) > quizStateActivityAt(older), "activity");

  const byId = findQuizStateBySessionId(sid);
  assert(byId?.mode === "figures", "find by sessionId");
  assert(byId?.phase === "results", "find results phase");

  const paymentRestore = findResumableQuizState({
    sessionId: sid,
    requireCompleted: true,
  });
  assert(paymentRestore?.sessionId === sid, "payment return restores session");
  assert(paymentRestore?.phase === "results", "payment return → results");
  assert(paymentRestore?.mode === "figures", "payment return mode");

  // F5 without URL session_id still prefers newest completed — never modeSelect.
  const f5 = findResumableQuizState({});
  assert(f5?.sessionId === sid, "F5 restores newest completed");
  assert(f5?.phase !== "modeSelect", "F5 never landing");

  // Unknown session_id must NOT dump to landing when a completed quiz exists.
  const missing = findResumableQuizState({
    sessionId: "iq_missing_nowhere",
    requireCompleted: true,
  });
  assert(
    missing?.sessionId === sid,
    "unknown sessionId + requireCompleted falls through to completed",
  );

  // URL helpers
  const href =
    "http://localhost:3010/teste-qi?payment_return=1&session_id=" +
    encodeURIComponent(sid) +
    "&order_nsu=ord_1&transaction_nsu=SIM_1&slug=sim&simulated=1";
  const historyStack: string[] = [href];
  (globalThis as { window: unknown }).window = {
    localStorage: (globalThis as { localStorage: Storage }).localStorage,
    location: {
      href,
      search: "?" + href.split("?")[1],
      pathname: "/teste-qi",
      hash: "",
    },
    history: {
      replaceState: (_s: unknown, _t: string, next: string) => {
        historyStack.push(
          next.startsWith("http") ? next : `http://localhost:3010${next}`,
        );
        const u = new URL(historyStack[historyStack.length - 1]!);
        (window as unknown as { location: { href: string; search: string; pathname: string; hash: string } }).location = {
          href: u.href,
          search: u.search,
          pathname: u.pathname,
          hash: u.hash,
        };
      },
    },
  };

  const ret = readIqPaymentReturnParams(window.location.search);
  assert(ret?.session_id === sid, "parse return session_id");
  assert(ret?.order_nsu === "ord_1", "parse order_nsu");

  cleanIqPaymentReturnUrl({ keepSessionId: sid });
  assert(
    window.location.search.includes(`session_id=${encodeURIComponent(sid)}`) ||
      window.location.search.includes(`session_id=${sid}`),
    `session_id kept after clean: ${window.location.search}`,
  );
  assert(
    !window.location.search.includes("payment_return"),
    "payment_return stripped",
  );
  assert(!window.location.search.includes("order_nsu"), "order_nsu stripped");

  ensureIqSessionIdInUrl(sid);
  assert(
    window.location.search.includes("session_id="),
    "ensure keeps session_id",
  );

  // Unknown session_id must still fall through to newest completed (not landing).
  const fallthrough = findResumableQuizState({
    sessionId: "iq_stale_not_in_storage",
    requireCompleted: true,
  });
  assert(
    fallthrough?.sessionId === sid,
    "stale session_id falls through to completed quiz",
  );

  const orderSid = extractIqSessionIdFromOrderNsu(
    `iq__${sid}__result__1795752495740`,
  );
  assert(orderSid === sid, "extract session from order_nsu");

  const coerced = coerceQuizSnapshot({
    ...newer,
    sessionId: sid,
  } as unknown as Record<string, unknown>);
  assert(coerced?.sessionId === sid, "coerce snapshot sessionId");
  assert(coerced?.phase === "results", "coerce snapshot phase");
  assert(coerceQuizSnapshot({ mode: "figures" }) === null, "reject bad snap");

  // InfinitePay-style return (transaction_id) still counts as payment return.
  const ipRet = readIqPaymentReturnParams(
    `?transaction_id=abc&receipt_url=https://recibo.infinitepay.io/abc&session_id=${encodeURIComponent(sid)}`,
  );
  assert(ipRet?.session_id === sid, "infinitepay transaction_id return");
  assert(ipRet?.transaction_nsu === "abc", "maps transaction_id");

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId: sid,
        restoredMode: paymentRestore?.mode,
        f5SessionId: f5?.sessionId,
        fallthroughSessionId: fallthrough?.sessionId,
        orderSid,
        urlAfterClean: window.location.search,
      },
      null,
      2,
    ),
  );
}

main();
