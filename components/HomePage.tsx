"use client";

import { CursorGlow } from "@/components/CursorGlow";
import { Footer } from "@/components/Footer";
import { HardwareShowcase } from "@/components/HardwareShowcase";
import { Header } from "@/components/Header";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PresaleCheckout } from "@/components/PresaleCheckout";
import { WalletNotice } from "@/components/WalletNotice";
import { HoverLift, Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { formatUsd, VISION_PRICE_USD } from "@/lib/presale";
import {
  Bluetooth,
  Droplets,
  Factory,
  Glasses,
  Lock,
  Rocket,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const TOKEN_ICONS = [Wallet, Droplets, Users, Lock] as const;
const PILLAR_ICONS = [Bluetooth, Factory, Rocket] as const;

export function HomePage() {
  const { t, locale } = useI18n();

  return (
    <>
      <CursorGlow />
      <Header />
      <WalletNotice />
      <LanguageSelector />

      <main className="relative z-10">
        <section
          id="topo"
          className="grid-aether relative scroll-mt-24 overflow-hidden border-b border-white/10"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.14),transparent_46%)]" />
          <div className="relative mx-auto grid min-h-[min(88vh,920px)] max-w-6xl items-center gap-14 px-5 py-20 md:grid-cols-[1.12fr_0.88fr] md:py-28">
            <Reveal>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan">
                <Sparkles size={12} />
                {t.hero.kicker}
              </p>
              <h1 className="font-display text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl md:text-[4.25rem]">
                {t.hero.title}
                <span className="mt-3 block bg-gradient-to-r from-cyan via-neon to-violet bg-clip-text text-transparent">
                  {t.hero.headline}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                {t.hero.body}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="#presale"
                  className="cta-pulse glow-cta rounded-full bg-gradient-to-r from-cyan to-neon px-6 py-3 text-sm font-medium text-onyx transition duration-300 hover:brightness-110"
                >
                  {t.hero.ctaPresale}
                </a>
                <a
                  href="#hardware"
                  className="rounded-full border border-white/10 px-6 py-3 text-sm text-ink transition duration-300 hover:border-cyan/40 hover:text-cyan"
                >
                  {t.hero.ctaHardware}
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.12} className="relative mx-auto min-w-0 w-full max-w-md">
              <div className="glass overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
                <Glasses className="mb-6 text-cyan" size={36} />
                <p className="font-display text-2xl tracking-tight">
                  {t.hero.cardTitle}
                </p>
                <p className="mt-2 text-sm text-muted">{t.hero.cardSub}</p>
                <dl className="mt-8 grid grid-cols-2 gap-5 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      {t.hero.app}
                    </dt>
                    <dd className="mt-1 text-ink">$VISION + $AETH</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      {t.hero.yield}
                    </dt>
                    <dd className="mt-1 text-cyan">Buyback & Burn</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      {t.hero.token}
                    </dt>
                    <dd className="mt-1 font-mono text-[13px] text-ink">
                      1B $VISION
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      {t.hero.vault}
                    </dt>
                    <dd className="mt-1 text-ink">Squads Multisig</dd>
                  </div>
                </dl>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="presale" className="scroll-mt-24 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
                {t.presale.kicker}
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                {t.presale.title}
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                {t.presale.leadBefore}{" "}
                <span className="text-cyan">
                  {formatUsd(VISION_PRICE_USD, locale)}
                </span>{" "}
                {t.presale.leadAfter}
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <PresaleCheckout />
            </Reveal>

            <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-muted">
              {t.presale.nativePay}
            </p>
          </div>
        </section>

        <section id="hardware" className="scroll-mt-24 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <HardwareShowcase />
          </div>
        </section>

        <section id="visao" className="scroll-mt-24 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.22em] text-violet">
                {t.vision.kicker}
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                {t.vision.title}
              </h2>
              <p className="mt-4 max-w-2xl text-muted">{t.vision.lead}</p>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {t.vision.points.map((item, index) => (
                <Reveal key={item.title} delay={0.05 * index}>
                  <HoverLift className="h-full">
                    <article className="h-full rounded-[1.75rem] border border-white/10 bg-surface/40 p-6 backdrop-blur-xl transition duration-500 hover:border-violet/35">
                      <h3 className="font-display text-lg tracking-tight">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        {item.body}
                      </p>
                    </article>
                  </HoverLift>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="tokenomics" className="scroll-mt-24 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
                {t.tokenomics.kicker}
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                {t.tokenomics.title}
              </h2>
              <p className="mt-4 max-w-2xl text-muted">{t.tokenomics.lead}</p>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {t.tokenomics.items.map((item, index) => {
                const Icon = TOKEN_ICONS[index];
                return (
                  <Reveal key={item.label} delay={0.05 * index}>
                    <HoverLift className="h-full">
                      <article className="h-full rounded-[1.75rem] border border-white/10 bg-surface/40 p-6 backdrop-blur-xl transition duration-500 hover:border-cyan/30">
                        <Icon className="text-cyan" size={18} />
                        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted">
                          {item.label}
                        </p>
                        <p className="mt-2 font-display text-3xl tracking-tight text-ink tabular">
                          {item.value}
                        </p>
                        <p className="mt-2 text-sm text-muted">{item.detail}</p>
                      </article>
                    </HoverLift>
                  </Reveal>
                );
              })}
            </div>
            <p className="mt-8 text-sm text-muted">{t.tokenomics.note}</p>
          </div>
        </section>

        <section
          id="desenvolvimento"
          className="scroll-mt-24 border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
                {t.updates.kicker}
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                {t.updates.title}
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                {t.updates.leadBefore}{" "}
                <a
                  href="https://x.com/VISIONAETH"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan transition hover:underline"
                >
                  @VISIONAETH
                </a>
                {t.updates.leadAfter}
              </p>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {t.updates.items.map((item, index) => {
                const Icon = PILLAR_ICONS[index];
                return (
                  <Reveal key={item.title} delay={0.06 * index}>
                    <HoverLift className="h-full">
                      <article className="h-full rounded-[1.75rem] border border-white/10 bg-surface/40 p-6 backdrop-blur-xl transition duration-500 hover:border-cyan/30">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
                          {t.updates.pillar} {index + 1}
                        </p>
                        <Icon className="mt-4 text-cyan" size={20} />
                        <h3 className="mt-4 font-display text-lg tracking-tight">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted">
                          {item.body}
                        </p>
                      </article>
                    </HoverLift>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
