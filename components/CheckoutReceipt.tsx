"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import { interpolate, useI18n } from "@/lib/i18n";
import { SQUADS_MULTISIG, solscanTx } from "@/lib/presale";

type CheckoutReceiptProps = {
  open: boolean;
  txHash: string | null;
  tierName?: string | null;
  onClose: () => void;
};

export function CheckoutReceipt({
  open,
  txHash,
  tierName,
  onClose,
}: CheckoutReceiptProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && txHash ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={t.receipt.close}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-receipt-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#09090b]/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full border border-white/10 p-1.5 text-muted transition hover:text-ink"
              aria-label={t.receipt.closeReceipt}
            >
              <X size={14} />
            </button>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 text-cyan">
              <Check size={18} />
            </span>
            <h2
              id="checkout-receipt-title"
              className="mt-4 font-display text-2xl tracking-tight"
            >
              {t.receipt.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {tierName
                ? interpolate(t.receipt.withTier, { tier: tierName })
                : t.receipt.noTier}
            </p>
            <p className="mt-3 break-all font-mono text-[11px] text-muted">
              {SQUADS_MULTISIG}
            </p>
            <a
              href={solscanTx(txHash)}
              target="_blank"
              rel="noreferrer"
              className="glow-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan to-neon px-4 py-3 text-sm font-medium text-onyx"
            >
              <ExternalLink size={15} />
              {t.receipt.solscan}
            </a>
            <p className="mt-3 break-all text-center font-mono text-[10px] text-muted">
              {txHash}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
