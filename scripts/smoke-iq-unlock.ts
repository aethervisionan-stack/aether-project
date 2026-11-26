/**
 * Headless smoke for IQ InfinitePay unlock helpers (no network).
 * Run: npx tsx scripts/smoke-iq-unlock.ts
 */
import {
  extractSessionIdFromOrderNsu,
  markIqSessionPaid,
  isIqSessionUnlocked,
  putIqUnlockSession,
} from "../lib/iq-payment/sessionUnlock";
import {
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
  iqPaymentSimulateLocal,
} from "../lib/iq-payment/config";
import { createIqSessionId } from "../src/lib/iqUnlockClient";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const amount = iqUnlockAmountCentavos();
  assert(amount === 100 || amount > 0, `amount centavos ${amount}`);
  const label100 = iqUnlockAmountLabel(100);
  assert(/R\$\s*1,00/.test(label100), `label R$1 got ${JSON.stringify(label100)}`);

  const sid = createIqSessionId();
  assert(sid.startsWith("iq_"), `session id ${sid}`);

  const order = `iq__${sid}__${Date.now()}`;
  assert(extractSessionIdFromOrderNsu(order) === sid, "extract session");

  await putIqUnlockSession({
    sessionId: sid,
    unlocked: false,
    order_nsu: order,
    amountCentavos: amount,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  assert(!(await isIqSessionUnlocked(sid)), "pending not unlocked");

  await markIqSessionPaid(sid, {
    order_nsu: order,
    amountCentavos: amount,
    simulated: true,
  });
  assert(await isIqSessionUnlocked(sid), "paid unlocks");

  // Localhost simulate gate
  assert(
    iqPaymentSimulateLocal("http://localhost:3010/api/payment/infinitepay/create") ===
      true ||
      process.env.INFINITEPAY_SIMULATE === "0" ||
      Boolean(process.env.INFINITEPAY_API_KEY?.trim()),
    "simulate local heuristic runs",
  );
  assert(
    iqPaymentSimulateLocal("https://example.com/api/x") === false ||
      process.env.INFINITEPAY_SIMULATE === "1",
    "non-local not simulated unless forced",
  );

  // localStorage-style flag alone does not unlock a fresh id
  const other = createIqSessionId();
  assert(!(await isIqSessionUnlocked(other)), "unknown session locked");

  console.log(
    JSON.stringify(
      {
        ok: true,
        amountCentavos: amount,
        amountLabel: iqUnlockAmountLabel(amount),
        sessionId: sid,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
