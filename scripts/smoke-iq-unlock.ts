/**
 * Headless smoke for IQ InfinitePay Pix unlock helpers (no network).
 * Run: npx tsx scripts/smoke-iq-unlock.ts
 */
import {
  beginIqUnlockCheckout,
  buildIqOrderNsu,
  extractItemTypeFromOrderNsu,
  extractSessionIdFromOrderNsu,
  isIqSessionAiUnlocked,
  isIqSessionResultUnlocked,
  isIqSessionUnlocked,
  markIqSessionPaid,
  putIqUnlockSession,
} from "../lib/iq-payment/sessionUnlock";
import {
  iqAiUpsellAmountCentavos,
  iqAmountCentavosForItemType,
  iqPaymentSimulateLocal,
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
} from "../lib/iq-payment/config";
import { createIqSessionId } from "../src/lib/iqUnlockClient";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const amount = iqUnlockAmountCentavos();
  assert(amount === 100 || amount > 0, `amount centavos ${amount}`);
  const aiAmount = iqAiUpsellAmountCentavos();
  assert(aiAmount === 100 || aiAmount > 0, `ai amount centavos ${aiAmount}`);
  const label100 = iqUnlockAmountLabel(100);
  assert(/R\$\s*1,00/.test(label100), `label R$1 got ${JSON.stringify(label100)}`);
  assert(
    iqAmountCentavosForItemType("result") === amount,
    "result amount helper",
  );
  assert(
    iqAmountCentavosForItemType("ai_upsell") === aiAmount,
    "ai amount helper",
  );

  const sid = createIqSessionId();
  assert(sid.startsWith("iq_"), `session id ${sid}`);

  const order = buildIqOrderNsu(sid, "result");
  assert(extractSessionIdFromOrderNsu(order) === sid, "extract session");
  assert(extractItemTypeFromOrderNsu(order) === "result", "extract result type");

  const legacyOrder = `iq__${sid}__${Date.now()}`;
  assert(extractSessionIdFromOrderNsu(legacyOrder) === sid, "legacy session");
  assert(
    extractItemTypeFromOrderNsu(legacyOrder) === "result",
    "legacy item type",
  );

  const paymentId = `sim_${sid}_result_${Date.now()}`;
  await putIqUnlockSession({
    sessionId: sid,
    unlocked: false,
    resultUnlocked: false,
    aiUnlocked: false,
    itemType: "result",
    paymentId,
    order_nsu: order,
    amountCentavos: amount,
    status: "pending",
    simulated: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  assert(!(await isIqSessionUnlocked(sid)), "pending not unlocked");
  assert(!(await isIqSessionResultUnlocked(sid)), "pending result locked");
  assert(!(await isIqSessionAiUnlocked(sid)), "pending ai locked");

  await markIqSessionPaid(sid, {
    paymentId,
    order_nsu: order,
    amountCentavos: amount,
    simulated: true,
    itemType: "result",
  });
  assert(await isIqSessionResultUnlocked(sid), "result paid unlocks");
  assert(await isIqSessionUnlocked(sid), "legacy unlocked alias");
  assert(!(await isIqSessionAiUnlocked(sid)), "ai still locked after result");

  const aiOrder = buildIqOrderNsu(sid, "ai_upsell");
  assert(extractItemTypeFromOrderNsu(aiOrder) === "ai_upsell", "ai order type");
  await beginIqUnlockCheckout({
    sessionId: sid,
    itemType: "ai_upsell",
    paymentId: `sim_${sid}_ai_${Date.now()}`,
    order_nsu: aiOrder,
    amountCentavos: aiAmount,
    simulated: true,
  });
  assert(await isIqSessionResultUnlocked(sid), "result flag survives AI checkout");
  assert(!(await isIqSessionAiUnlocked(sid)), "ai pending still locked");

  await markIqSessionPaid(sid, {
    paymentId: `sim_${sid}_ai_paid`,
    order_nsu: aiOrder,
    amountCentavos: aiAmount,
    simulated: true,
    itemType: "ai_upsell",
  });
  assert(await isIqSessionResultUnlocked(sid), "result still unlocked");
  assert(await isIqSessionAiUnlocked(sid), "ai paid unlocks");

  // Localhost simulate gate
  assert(
    iqPaymentSimulateLocal("http://localhost:3010/api/payment/pix/create") ===
      true ||
      process.env.INFINITEPAY_SIMULATE === "0" ||
      Boolean(process.env.INFINITEPAY_API_KEY?.trim()) ||
      Boolean(process.env.INFINITEPAY_HANDLE?.trim()),
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
  assert(!(await isIqSessionAiUnlocked(other)), "unknown ai locked");

  console.log(
    JSON.stringify(
      {
        ok: true,
        amountCentavos: amount,
        aiAmountCentavos: aiAmount,
        amountLabel: iqUnlockAmountLabel(amount),
        aiAmountLabel: iqUnlockAmountLabel(aiAmount),
        sessionId: sid,
        paymentId,
        order_nsu: order,
        aiOrder_nsu: aiOrder,
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
