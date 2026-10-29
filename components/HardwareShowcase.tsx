"use client";

import { CheckoutReceipt } from "@/components/CheckoutReceipt";
import { HoverLift, Reveal } from "@/components/Reveal";
import { useAetherCheckout } from "@/hooks/useAetherCheckout";
import { HARDWARE_LINE } from "@/lib/hardware";
import { translateError, useI18n } from "@/lib/i18n";
import { formatUsd, MIN_SOL, PRESALE_TIERS } from "@/lib/presale";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const TIER_BY_ID = Object.fromEntries(
  PRESALE_TIERS.map((tier) => [tier.id, tier]),
);

export function HardwareShowcase() {
  const { t, locale } = useI18n();
  const {
    loading,
    txHash,
    error,
    errorDetail,
    status,
    tierName,
    handlePurchase,
    reset,
    connected,
    solForUsd,
  } = useAetherCheckout();
  const [buyingId, setBuyingId] = useState<string | null>(null);

  async function buyTier(deviceId: string, name: string, usd: number) {
    setBuyingId(deviceId);
    await handlePurchase(name, solForUsd(usd));
    setBuyingId(null);
  }

  return (
    <div>
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
          {t.hardware.kicker}
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
          {t.hardware.title}
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-muted">{t.hardware.lead}</p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
        {HARDWARE_LINE.map((device, index) => {
          const tier = TIER_BY_ID[device.tierId];
          const copy = t.hardware[device.id];
          const busy = loading && buyingId === device.id;
          return (
            <Reveal key={device.id} delay={0.05 * index}>
              <HoverLift className="h-full">
                <article
                  className={`flex h-full min-w-0 flex-col rounded-[1.75rem] border p-6 backdrop-blur-xl transition duration-500 sm:p-8 ${
                    device.halo
                      ? "border-cyan/30 bg-gradient-to-b from-cyan/[0.07] via-surface/60 to-violet/[0.06] shadow-[0_0_48px_rgba(6,182,212,0.1)] hover:border-cyan/50"
                      : "border-white/10 bg-surface/40 hover:border-cyan/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                      {copy.tag}
                    </p>
                    <p className="font-display text-3xl tracking-tight text-cyan tabular">
                      {device.version}
                    </p>
                  </div>

                  <h3 className="mt-5 font-display text-2xl tracking-tight sm:text-[1.65rem]">
                    {device.name}
                  </h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cyan">
                    {copy.category}
                  </p>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-ink">
                    {copy.headline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {copy.body}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-ink/65">
                    {copy.frame}
                  </p>

                  <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
                    {copy.specs.map((spec) => (
                      <div
                        key={spec.label}
                        className="flex min-w-0 items-baseline justify-between gap-4 py-2.5"
                      >
                        <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                          {spec.label}
                        </dt>
                        <dd className="max-w-[65%] text-pretty text-right text-sm text-ink">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {tier ? (
                    <p className="mt-5 font-mono text-xs text-cyan tabular">
                      {formatUsd(tier.usd, locale)} · +{tier.bonusPct}% $VISION
                    </p>
                  ) : null}

                  <div className="flex-1" />

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      if (!tier) return;
                      void buyTier(device.id, device.name, tier.usd);
                    }}
                    className="cta-pulse glow-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan to-neon px-4 py-2.5 text-sm font-medium text-onyx transition duration-300 hover:brightness-110 disabled:opacity-55"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        {t.checkout.confirming}
                      </>
                    ) : connected ? (
                      copy.cta
                    ) : (
                      t.hardware.connectBuy
                    )}
                  </button>
                </article>
              </HoverLift>
            </Reveal>
          );
        })}
      </div>

      {status === "cancelled" ? (
        <p className="mt-6 text-center text-sm text-muted" role="status">
          {translateError(t, error, MIN_SOL, errorDetail)}
        </p>
      ) : null}
      {status === "error" && error ? (
        <p className="mt-6 text-center text-sm text-red-400" role="status">
          {translateError(t, error, MIN_SOL, errorDetail)}
        </p>
      ) : null}

      <CheckoutReceipt
        open={status === "success"}
        txHash={txHash}
        tierName={tierName}
        onClose={reset}
      />
    </div>
  );
}
