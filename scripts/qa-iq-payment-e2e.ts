/**
 * Exhaustive IQ payment / session QA against a live localhost:3010 server.
 * Never opens a browser. Uses fetch only.
 *
 * Expects INFINITEPAY_SIMULATE=1 on the server for happy-path sim cycles.
 * Production-default checks assert canSimApprove=false when SIMULATE is off.
 *
 * Run: npx tsx scripts/qa-iq-payment-e2e.ts
 * Optional: IQ_QA_BASE=http://127.0.0.1:3010
 */
import { createIqSessionId } from "../src/lib/iqUnlockClient";
import {
  findResumableQuizState,
  saveQuizState,
  clearQuizState,
  createInitialState,
} from "../src/lib/quizStorage";
import type { IqResult, QuizPersistedState } from "../src/types/quiz";
import { QUIZ_STORAGE_VERSION } from "../src/types/quiz";

const BASE = (process.env.IQ_QA_BASE ?? "http://localhost:3010").replace(
  /\/$/,
  "",
);

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function ok(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond: unknown, name: string, detail?: string): asserts cond {
  if (cond) ok(name, detail);
  else fail(name, detail);
}

async function jsonFetch(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

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
}

function stubResult(): IqResult {
  return {
    mode: "figures",
    rawScore: 22,
    maxScore: 30,
    accuracy: 0.73,
    iq: 118,
    theta: 0.6,
    marginOfError: 5,
    confidenceMargin: 5,
    consistencyScore: 85,
    iqLow: 113,
    iqHigh: 123,
    percentile: 88,
    band: "Superior",
    competences: {
      spatial: 120,
      boolean: 115,
      pattern: 118,
      numerical: 116,
      logical: 117,
      numeric: 116,
      verbal: 114,
      analytical: 119,
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
    avgTimeMs: 11_000,
    timeMetrics: {
      meanMs: 11_000,
      medianMs: 10_000,
      p90Ms: 18_000,
      rushCount: 0,
      slowCount: 0,
    },
    answers: [],
    diagnosis: {
      consistencyScore: 85,
      reliabilityLabel: "Alta",
      notes: [],
    },
  } as unknown as IqResult;
}

function finishedState(sessionId: string): QuizPersistedState {
  const base = createInitialState("figures", 30, "QA Payment", null, 99);
  return {
    ...base,
    version: QUIZ_STORAGE_VERSION,
    phase: "results",
    startedAt: Date.now() - 600_000,
    endsAt: Date.now() + 1000,
    finishedAt: Date.now(),
    result: stubResult(),
    sessionId,
    resultsUnlocked: false,
    unlockOrderNsu: null,
    answers: Array(30).fill(0),
    timeSpentMs: Array(30).fill(9_000),
    optionSwitches: Array(30).fill(0),
  };
}

async function main() {
  console.log(`\nIQ payment E2E QA @ ${BASE}\n`);

  // --- Reachability ---
  {
    const res = await fetch(`${BASE}/teste-qi`);
    assert(res.status === 200, "GET /teste-qi → 200");
  }

  // --- Detect simulate mode on server ---
  const probeSid = createIqSessionId();
  const probeCreate = await jsonFetch("/api/payment/pix/create", {
    method: "POST",
    body: JSON.stringify({ sessionId: probeSid, itemType: "result" }),
  });
  assert(probeCreate.status === 200, "create probe HTTP 200");
  const simMode = Boolean(probeCreate.data.simulated);
  const canSim = Boolean(probeCreate.data.canSimApprove);
  console.log(
    `\n  [mode] simulated=${simMode} canSimApprove=${canSim} checkout=${Boolean(probeCreate.data.checkoutUrl)}\n`,
  );

  if (simMode) {
    assert(canSim === true, "sim mode exposes canSimApprove");
    assert(
      typeof probeCreate.data.checkoutUrl === "string" &&
        String(probeCreate.data.checkoutUrl).includes("payment_return=1") &&
        String(probeCreate.data.checkoutUrl).includes(
          `session_id=${encodeURIComponent(probeSid)}`,
        ),
      "sim checkoutUrl keeps sessionId + payment_return",
    );

    // Happy path: result unlock via simApprove
    const sid = createIqSessionId();
    const created = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: sid, itemType: "result" }),
    });
    assert(created.status === 200 && created.data.simulated === true, "create result sim");
    const orderNsu = String(created.data.order_nsu ?? "");
    assert(orderNsu.includes(sid), "order_nsu encodes sessionId");

    const pending = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(sid)}&itemType=result`,
    );
    assert(
      pending.data.resultUnlocked === false && pending.data.aiUnlocked === false,
      "pending stays locked",
    );

    // Persist quiz snapshot (payment return restore)
    const snap = finishedState(sid);
    const saved = await jsonFetch("/api/iq-session", {
      method: "POST",
      body: JSON.stringify({
        sessionId: sid,
        quizSnapshot: snap as unknown as Record<string, unknown>,
      }),
    });
    assert(saved.status === 200 && saved.data.ok === true, "persist quiz snapshot");

    const approved = await jsonFetch("/api/payment/pix/status", {
      method: "POST",
      body: JSON.stringify({
        sessionId: sid,
        itemType: "result",
        simApprove: true,
        order_nsu: orderNsu,
        simulated: true,
      }),
    });
    assert(
      approved.data.resultUnlocked === true && approved.data.aiUnlocked === false,
      "happy path result unlock; AI still locked",
      `result=${approved.data.resultUnlocked} ai=${approved.data.aiUnlocked}`,
    );

    // External return / F5: status with return hints
    const ret = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(sid)}&order_nsu=${encodeURIComponent(orderNsu)}&transaction_nsu=SIM_ret&slug=sim&simulated=1`,
    );
    assert(
      ret.data.resultUnlocked === true && ret.data.sessionId === sid,
      "payment return status keeps sessionId + resultUnlocked",
    );

    const restored = await jsonFetch(
      `/api/iq-session?sessionId=${encodeURIComponent(sid)}`,
    );
    assert(
      restored.data.hasQuizSnapshot === true &&
        restored.data.resultUnlocked === true &&
        (restored.data.quizSnapshot as { phase?: string } | null)?.phase ===
          "results",
      "return restore opens results snapshot directly",
    );

    // AI upsell independent
    const aiCreate = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: sid, itemType: "ai_upsell" }),
    });
    assert(aiCreate.status === 200 && aiCreate.data.simulated === true, "create AI upsell");
    const aiOrder = String(aiCreate.data.order_nsu ?? "");
    const beforeAi = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(sid)}&itemType=ai_upsell`,
    );
    assert(
      beforeAi.data.resultUnlocked === true && beforeAi.data.aiUnlocked === false,
      "AI pending: result stays unlocked, AI locked",
    );
    const aiPaid = await jsonFetch("/api/payment/pix/status", {
      method: "POST",
      body: JSON.stringify({
        sessionId: sid,
        itemType: "ai_upsell",
        simApprove: true,
        order_nsu: aiOrder,
        simulated: true,
      }),
    });
    assert(
      aiPaid.data.resultUnlocked === true && aiPaid.data.aiUnlocked === true,
      "AI unlock independent of result",
    );

    // Regression: after result paid, AI return must mark aiUnlocked even when
    // the result order is already paid in the store (no short-circuit).
    const aiRetSid = createIqSessionId();
    const r1 = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: aiRetSid, itemType: "result" }),
    });
    await jsonFetch("/api/payment/pix/status", {
      method: "POST",
      body: JSON.stringify({
        sessionId: aiRetSid,
        itemType: "result",
        simApprove: true,
        order_nsu: r1.data.order_nsu,
        simulated: true,
      }),
    });
    const a1 = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: aiRetSid, itemType: "ai_upsell" }),
    });
    const aiOrderNsu = String(a1.data.order_nsu ?? "");
    const aiReturn = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(aiRetSid)}&itemType=ai_upsell&order_nsu=${encodeURIComponent(aiOrderNsu)}&transaction_nsu=SIM_ai_ret&slug=sim-iq-local&simulated=1`,
    );
    assert(
      aiReturn.data.resultUnlocked === true &&
        aiReturn.data.aiUnlocked === true,
      "AI payment_return unlocks aiUnlocked (not stuck on result order)",
      `ai=${aiReturn.data.aiUnlocked} result=${aiReturn.data.resultUnlocked}`,
    );

    // Combo happy path on fresh session
    const comboSid = createIqSessionId();
    const combo = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({
        sessionId: comboSid,
        itemType: "result",
        includeAi: true,
      }),
    });
    assert(
      combo.data.itemType === "combo" &&
        Number(combo.data.amountCentavos) === 200,
      "combo amount 200 centavos",
    );
    const comboPaid = await jsonFetch("/api/payment/pix/status", {
      method: "POST",
      body: JSON.stringify({
        sessionId: comboSid,
        itemType: "combo",
        simApprove: true,
        order_nsu: combo.data.order_nsu,
        simulated: true,
      }),
    });
    assert(
      comboPaid.data.resultUnlocked === true &&
        comboPaid.data.aiUnlocked === true,
      "combo unlocks both flags",
    );

    // Webhook delay: create → webhook paid → status
    const whSid = createIqSessionId();
    const whCreate = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: whSid, itemType: "result" }),
    });
    const whOrder = String(whCreate.data.order_nsu ?? "");
    const whPending = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(whSid)}`,
    );
    assert(whPending.data.resultUnlocked === false, "pre-webhook still locked");
    const wh = await jsonFetch("/api/payment/pix/webhook", {
      method: "POST",
      body: JSON.stringify({
        order_nsu: whOrder,
        status: "paid",
        transaction_nsu: `tx_${Date.now()}`,
        slug: "wh-sim",
        amount: 100,
      }),
    });
    assert(
      wh.data.ok === true &&
        wh.data.sessionId === whSid &&
        wh.data.resultUnlocked === true,
      "webhook unlock keeps sessionId",
    );
    const whStatus = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(whSid)}`,
    );
    assert(whStatus.data.resultUnlocked === true, "status after webhook delay");

    // Cancel / expired / non-paid webhook must NOT unlock
    const cancelSid = createIqSessionId();
    const cancelCreate = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: cancelSid, itemType: "result" }),
    });
    const cancelOrder = String(cancelCreate.data.order_nsu ?? "");
    await jsonFetch("/api/payment/pix/webhook", {
      method: "POST",
      body: JSON.stringify({
        order_nsu: cancelOrder,
        status: "cancelled",
        event: "payment.cancelled",
      }),
    });
    const cancelStatus = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(cancelSid)}`,
    );
    assert(
      cancelStatus.data.resultUnlocked === false,
      "cancel webhook does not unlock",
    );

    await jsonFetch("/api/payment/pix/webhook", {
      method: "POST",
      body: JSON.stringify({
        order_nsu: cancelOrder,
        status: "expired",
        event: "payment.expired",
      }),
    });
    const expiredStatus = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(cancelSid)}`,
    );
    assert(
      expiredStatus.data.resultUnlocked === false,
      "expired webhook does not unlock",
    );

    // Network-ish: bad sessionId
    const bad = await jsonFetch("/api/payment/pix/status?sessionId=not_iq");
    assert(bad.status === 400 && bad.data.resultUnlocked === false, "bad sessionId rejected");

    // AI without result → 409
    const earlyAi = createIqSessionId();
    const early = await jsonFetch("/api/payment/pix/create", {
      method: "POST",
      body: JSON.stringify({ sessionId: earlyAi, itemType: "ai_upsell" }),
    });
    assert(early.status === 409 && early.data.code === "RESULT_REQUIRED", "AI requires result first");
  } else {
    ok(
      "real InfinitePay mode (sim OFF)",
      "skipping simApprove happy-path; forge + pending checks still run",
    );
    assert(canSim === false, "production-default: canSimApprove false with real creds");
    assert(
      typeof probeCreate.data.checkoutUrl === "string" &&
        String(probeCreate.data.checkoutUrl).includes("checkout.infinitepay.io"),
      "real checkout URL is InfinitePay",
    );
    // Pending stays locked
    const pending = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(probeSid)}`,
    );
    assert(
      pending.data.resultUnlocked === false && pending.data.canSimApprove === false,
      "real pending locked + no sim button gate",
    );
  }

  // --- Forge attacks (always) ---
  console.log("\n  [forge]\n");
  {
    const victim = createIqSessionId();
    const attacker = createIqSessionId();
    // Forge URL params alone
    const forgeUrl = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(attacker)}&order_nsu=iq__${encodeURIComponent(victim)}__result__1&transaction_nsu=SIM_FORGE&slug=x&simulated=1`,
    );
    assert(
      forgeUrl.data.resultUnlocked === false &&
        forgeUrl.data.aiUnlocked === false,
      "forged URL SIM_ params do NOT unlock",
    );

    // Forge localStorage-style: no server row → locked
    const ls = await jsonFetch(
      `/api/payment/pix/status?sessionId=${encodeURIComponent(createIqSessionId())}`,
    );
    assert(ls.data.resultUnlocked === false, "unknown session localStorage-only stays locked");

    // Cross-session: paid victim order must not unlock attacker
    if (simMode) {
      const vCreate = await jsonFetch("/api/payment/pix/create", {
        method: "POST",
        body: JSON.stringify({ sessionId: victim, itemType: "result" }),
      });
      const vOrder = String(vCreate.data.order_nsu ?? "");
      await jsonFetch("/api/payment/pix/status", {
        method: "POST",
        body: JSON.stringify({
          sessionId: victim,
          simApprove: true,
          order_nsu: vOrder,
          itemType: "result",
        }),
      });
      const cross = await jsonFetch("/api/payment/pix/status", {
        method: "POST",
        body: JSON.stringify({
          sessionId: attacker,
          order_nsu: vOrder,
          transaction_nsu: "SIM_CROSS",
          slug: "x",
          simulated: true,
          itemType: "result",
        }),
      });
      assert(
        cross.data.resultUnlocked === false,
        "cross-session paid order_nsu does NOT unlock attacker",
      );

      const verifyCross = await jsonFetch("/api/payment/infinitepay/verify", {
        method: "POST",
        body: JSON.stringify({
          sessionId: attacker,
          order_nsu: vOrder,
          transaction_nsu: "SIM_X",
          simulated: true,
        }),
      });
      assert(
        verifyCross.status === 403 || verifyCross.data.paid === false,
        "verify rejects cross-session order",
        `status=${verifyCross.status} code=${verifyCross.data.code}`,
      );
    }
  }

  // --- Bare /teste-qi restore semantics (headless storage) ---
  console.log("\n  [restore]\n");
  {
    installMemoryStorage();
    clearQuizState();
    const sid = createIqSessionId();
    saveQuizState(finishedState(sid));
    assert(
      findResumableQuizState({}) === null,
      "bare /teste-qi does NOT auto-open completed results",
    );
    const payRestore = findResumableQuizState({
      sessionId: sid,
      requireCompleted: true,
    });
    assert(
      payRestore?.phase === "results" && payRestore.sessionId === sid,
      "payment return / session_id opens results directly",
    );

    // Client resultsUnlocked forge alone is irrelevant server-side (already covered);
    // storage flag without requireCompleted still ignored on bare URL.
    const forged = finishedState(createIqSessionId());
    forged.resultsUnlocked = true;
    saveQuizState(forged);
    assert(
      findResumableQuizState({}) === null,
      "forged resultsUnlocked localStorage does not open on bare URL",
    );
  }

  // --- Gemini gate smoke (402 when locked) ---
  {
    const locked = createIqSessionId();
    const gem = await jsonFetch("/api/iq-profile-assistant", {
      method: "POST",
      body: JSON.stringify({
        sessionId: locked,
        message: "oi",
        profile: { iq: 100, mode: "figures" },
      }),
    });
    assert(
      gem.status === 402 ||
        gem.data.code === "LOCKED" ||
        gem.data.aiUnlocked === false,
      "Gemini locked without aiUnlocked",
      `status=${gem.status} code=${gem.data.code}`,
    );
  }

  // --- Psychometric / UI smoke scripts already cover scoring; ping page HTML ---
  {
    const html = await (await fetch(`${BASE}/teste-qi`)).text();
    assert(
      html.includes("teste-qi") || html.length > 500,
      "psychometric UI page serves content",
    );
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${JSON.stringify(
      {
        ok: failed.length === 0,
        base: BASE,
        simMode,
        passed: checks.filter((c) => c.ok).length,
        failed: failed.length,
        failures: failed,
      },
      null,
      2,
    )}\n`,
  );
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
