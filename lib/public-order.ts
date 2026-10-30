import type { VisionOrder } from "@/lib/orders";

export function toPublicOrder(order: VisionOrder) {
  return {
    id: order.id,
    status: order.status,
    method: order.method,
    usd: order.usd,
    brl: order.brl,
    visionAmount: order.visionAmount,
    destPubkey: order.destPubkey,
    tierName: order.tierName,
    pixCopyPaste: order.pixCopyPaste,
    pixTxid: order.pixTxid,
    solLamports: order.solLamports,
    solSignature: order.solSignature,
    splSignature: order.splSignature,
    fulfillError: order.fulfillError,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
