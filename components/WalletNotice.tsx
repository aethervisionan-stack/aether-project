"use client";

import { useI18n } from "@/lib/i18n";
import { hasInjectedSolanaWallet, requestWalletSession } from "@/lib/site";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function WalletNotice() {
  const { t } = useI18n();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasInjectedSolanaWallet());
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="relative z-40 overflow-hidden border-b border-white/10 bg-cyan/[0.06]"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-muted">{t.wallet.body}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  requestWalletSession(
                    () => setWalletModalVisible(true),
                    "phantom",
                  )
                }
                className="rounded-full bg-gradient-to-r from-cyan to-neon px-3 py-1.5 text-xs font-medium text-onyx"
              >
                {t.wallet.phantom}
              </button>
              <button
                type="button"
                onClick={() =>
                  requestWalletSession(
                    () => setWalletModalVisible(true),
                    "backpack",
                  )
                }
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink transition hover:border-cyan/40 hover:text-cyan"
              >
                {t.wallet.backpack}
              </button>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                {t.wallet.later}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
