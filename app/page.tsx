"use client";

import { CursorGlow } from "@/components/CursorGlow";
import { Footer } from "@/components/Footer";
import { HardwareShowcase } from "@/components/HardwareShowcase";
import { Header } from "@/components/Header";
import { PresaleCheckout } from "@/components/PresaleCheckout";
import { HoverLift, Reveal } from "@/components/Reveal";
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

const TOKENOMICS = [
  {
    icon: Wallet,
    label: "Pré-venda / Soft Launch",
    value: "10–20%",
    detail:
      "100M a 200M $VISION a $0,05. Arrecadação estimada de até $10M para financiar óculos e o app por anos.",
  },
  {
    icon: Droplets,
    label: "Liquidez Raydium",
    value: "40%",
    detail:
      "400M $VISION no pool DEX, alocados com os fundos arrecadados após a pré-venda.",
  },
  {
    icon: Users,
    label: "Ecossistema & Recompensas",
    value: "30%",
    detail:
      "300M $VISION para cashback, bônus de indicação e recompensas DePIN do app.",
  },
  {
    icon: Lock,
    label: "Time & Marketing",
    value: "10%",
    detail:
      "100M $VISION travados para o time de desenvolvimento e expansão de longo prazo.",
  },
] as const;

const PILLARS = [
  {
    icon: Bluetooth,
    title: "App Bridge",
    body: "Integração Bluetooth entre o smartphone e os óculos Aether Vision — áudio, voz e sessão do app de IA em um único fluxo.",
  },
  {
    icon: Factory,
    title: "Primeiro lote",
    body: "Arrecadação para fabricação e lançamento do primeiro lote de óculos, com custo acessível e função no centro do produto.",
  },
  {
    icon: Rocket,
    title: "Mainnet $AETH",
    body: "Arrecadação estratégica para o lançamento da criptomoeda $AETH com blockchain nativa, além do token $VISION na Solana.",
  },
] as const;

const VISION_POINTS = [
  {
    title: "Vision 1.0 ao Vision 4.0",
    body: "Uma linha progressiva: do smart audio essencial ao flagship Micro-OLED AR — função no centro, custo acessível no início, ápice tecnológico no topo.",
  },
  {
    title: "Valorização contínua do ecossistema",
    body: "O objetivo principal é a valorização do ecossistema AETHER e o desenvolvimento progressivo de modelos de óculos superiores.",
  },
  {
    title: "Buyback & Burn automatizado",
    body: "Com o sucesso de vendas do primeiro lote, o mecanismo compra e queima $AETH e $VISION, reduzindo oferta conforme o uso real.",
  },
  {
    title: "Caixa para a próxima geração",
    body: "A receita reabastece o caixa do projeto para desenvolver e lançar modelos ainda mais avançados.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <CursorGlow />
      <Header />

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
                Solana DePIN + AI Wearable
              </p>
              <h1 className="font-display text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl md:text-[4.25rem]">
                Aether Vision
                <span className="mt-3 block bg-gradient-to-r from-cyan via-neon to-violet bg-clip-text text-transparent">
                  A Ponte Definitiva entre Hardware e Inteligência Artificial
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                O primeiro modelo é simples, funcional e acessível. Assinaturas
                do app de IA aceitam $VISION e $AETH. Com as vendas, buyback
                automático queima os dois tokens e reabastece o caixa para a
                próxima geração de hardware.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="#presale"
                  className="glow-cta rounded-full bg-gradient-to-r from-cyan to-neon px-6 py-3 text-sm font-medium text-onyx transition duration-300 hover:brightness-110"
                >
                  Participar da pré-venda
                </a>
                <a
                  href="#hardware"
                  className="rounded-full border border-white/10 px-6 py-3 text-sm text-ink transition duration-300 hover:border-cyan/40 hover:text-cyan"
                >
                  Ver o hardware
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.12} className="relative mx-auto min-w-0 w-full max-w-md">
              <div className="glass overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
                <Glasses className="mb-6 text-cyan" size={36} />
                <p className="font-display text-2xl tracking-tight">
                  Linha Vision
                </p>
                <p className="mt-2 text-sm text-muted">
                  Vision 1.0 → 4.0 · App Bridge · middleware de IA
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-5 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      App
                    </dt>
                    <dd className="mt-1 text-ink">$VISION + $AETH</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      Yield
                    </dt>
                    <dd className="mt-1 text-cyan">Buyback & Burn</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      Token
                    </dt>
                    <dd className="mt-1 font-mono text-[13px] text-ink">
                      1B $VISION
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      Vault
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
                Pré-venda · Tesouraria
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                Kits Hardware + Tokens
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                Preço oficial:{" "}
                <span className="text-cyan">{formatUsd(VISION_PRICE_USD)}</span>{" "}
                por 1 $VISION. Conecte Phantom ou Backpack e envie SOL para a
                Squads Multisig. Assinaturas mensais aceitam nativamente{" "}
                <span className="text-ink">$AETH</span> e{" "}
                <span className="text-ink">$VISION</span>.
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <PresaleCheckout />
            </Reveal>

            <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-muted">
              Pagamento das assinaturas mensais do aplicativo:{" "}
              <span className="text-ink">$AETH</span> e{" "}
              <span className="text-ink">$VISION</span> são aceitos nativamente.
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
                Visão do produto
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                Estratégia de valorização AETHER
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                Hardware acessível agora, tesouraria transparente, e um ciclo em
                que vendas alimentam queima de tokens e o próximo modelo.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {VISION_POINTS.map((item, index) => (
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
                Tokenomics transparente
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                $VISION · 1.000.000.000
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                Supply fixo de 1 bilhão. Pré-venda entre 10% e 20% a $0,05.
                Liquidez, recompensas do app e time com alocação pública.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {TOKENOMICS.map((item, index) => (
                <Reveal key={item.label} delay={0.05 * index}>
                  <HoverLift className="h-full">
                    <article className="h-full rounded-[1.75rem] border border-white/10 bg-surface/40 p-6 backdrop-blur-xl transition duration-500 hover:border-cyan/30">
                      <item.icon className="text-cyan" size={18} />
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
              ))}
            </div>
            <p className="mt-8 text-sm text-muted">
              $AETH entra na mainnet nativa; $VISION opera o app e a liquidez na
              Solana. Ambos entram no ciclo de Buyback & Burn após o primeiro
              lote.
            </p>
          </div>
        </section>

        <section
          id="desenvolvimento"
          className="scroll-mt-24 border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
                Desenvolvimento & atualizações
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight md:text-5xl md:tracking-[-0.03em]">
                Build constante, no X oficial
              </h2>
              <p className="mt-4 max-w-2xl text-muted">
                Não publicamos um roadmap estático. As atualizações de
                desenvolvimento são contínuas e saem no canal oficial{" "}
                <a
                  href="https://x.com/VISIONAETH"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan transition hover:underline"
                >
                  @VISIONAETH
                </a>
                .
              </p>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {PILLARS.map((item, index) => (
                <Reveal key={item.title} delay={0.06 * index}>
                  <HoverLift className="h-full">
                    <article className="h-full rounded-[1.75rem] border border-white/10 bg-surface/40 p-6 backdrop-blur-xl transition duration-500 hover:border-cyan/30">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
                        Pilar {index + 1}
                      </p>
                      <item.icon className="mt-4 text-cyan" size={20} />
                      <h3 className="mt-4 font-display text-lg tracking-tight">
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
      </main>

      <Footer />
    </>
  );
}
