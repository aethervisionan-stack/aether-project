"use client";

import { HARDWARE_LINE } from "@/lib/hardware";
import { formatUsd, PRESALE_TIERS, requestPresaleTier } from "@/lib/presale";
import { HoverLift, Reveal } from "@/components/Reveal";

const TIER_BY_ID = Object.fromEntries(
  PRESALE_TIERS.map((tier) => [tier.id, tier]),
);

export function HardwareShowcase() {
  return (
    <div>
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
          Linha Vision
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
          Quatro gerações. Um middleware.
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-muted">
          Vision 1.0 a Vision 4.0 conectam o usuário à IA descentralizada da
          Aether. Uma vitrine, quatro alocações na pré-venda on-chain.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
        {HARDWARE_LINE.map((device, index) => {
          const tier = TIER_BY_ID[device.tierId];
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
                      {device.tag}
                    </p>
                    <p className="font-display text-3xl tracking-tight text-cyan tabular">
                      {device.version}
                    </p>
                  </div>

                  <h3 className="mt-5 font-display text-2xl tracking-tight sm:text-[1.65rem]">
                    {device.name}
                  </h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cyan">
                    {device.category}
                  </p>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-ink">
                    {device.headline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {device.body}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-ink/65">
                    {device.frame}
                  </p>

                  <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
                    {device.specs.map((spec) => (
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
                      {formatUsd(tier.usd)} · +{tier.bonusPct}% $VISION
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => requestPresaleTier(device.tierId)}
                    className={`mt-auto w-full rounded-full px-4 py-2.5 text-sm font-medium transition duration-300 ${
                      device.halo
                        ? "glow-cta mt-6 bg-gradient-to-r from-cyan to-neon text-onyx hover:brightness-110"
                        : "mt-6 border border-white/10 text-ink hover:border-cyan/40 hover:text-cyan"
                    }`}
                  >
                    {device.cta}
                  </button>
                </article>
              </HoverLift>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
