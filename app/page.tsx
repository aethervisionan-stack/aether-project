"use client";

import {
  AudioLines,
  BatteryCharging,
  Bluetooth,
  Check,
  Copy,
  Crown,
  Droplets,
  Factory,
  Gift,
  Glasses,
  Lock,
  Mail,
  Menu,
  Mic,
  Rocket,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const VISION_PRICE_USD = 0.05;
const FALLBACK_SOL_USD = 150;

function visionFromUsd(usd: number): number {
  return usd / VISION_PRICE_USD;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatVision(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

const NAV = [
  { href: "#hardware", label: "Hardware" },
  { href: "#presale", label: "Pré-venda" },
  { href: "#tokenomics", label: "Tokenomics" },
  { href: "#visao", label: "Visão" },
  { href: "#desenvolvimento", label: "Updates" },
] as const;

const SQUADS_VAULT = "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa";
const X_URL = "https://x.com/VISIONAETH";
const SUPPORT_EMAIL = "aethervision.an@gmail.com";

const HARDWARE = [
  {
    icon: Bluetooth,
    title: "Bluetooth 5.3 Ultra-Low Latency",
    body: "Conexão instantânea com o App Bridge. Latência ultra-baixa para voz, HUD e sync on-chain sem drop em ambientes densos de RF.",
  },
  {
    icon: Mic,
    title: "Microfones MEMS com IA",
    body: "Array MEMS com isolamento acústico de ruído externo. Comandos de voz nítidos mesmo em rua, metrô ou palco.",
  },
  {
    icon: AudioLines,
    title: "Áudio Aberto Direcional",
    body: "Som estéreo privado direcionado aos ouvidos — open-ear, sem intra-auriculares. Você ouve o mundo e a rede ao mesmo tempo.",
  },
  {
    icon: BatteryCharging,
    title: "Bateria & Carga Magnética",
    body: "Autonomia para o dia todo com recarga rápida nas hastes. Ciclo magnético para voltar à rede em minutos.",
  },
] as const;

const KITS = [
  {
    id: "bronze",
    name: "Kit Vision Bronze",
    price: "$50",
    icon: Gift,
    highlight: false,
    badge: "Voucher de consumo",
    items: [
      `${formatVision(visionFromUsd(50))} $VISION (US$ 50 ÷ ${formatUsd(VISION_PRICE_USD)})`,
      "Equivalente a 3 meses de assinatura do app de IA",
      "Ideal para quem já possui óculos Bluetooth e quer usar o app",
    ],
  },
  {
    id: "gold",
    name: "Kit Vision Gold",
    price: "$200",
    icon: Glasses,
    highlight: false,
    badge: "Hardware + voucher",
    items: [
      "1 óculos inteligente Bluetooth Aether Vision",
      `${formatVision(visionFromUsd(200))} $VISION inclusos (US$ 200 ÷ ${formatUsd(VISION_PRICE_USD)})`,
      "Equivalente a 6 meses de assinatura do app de IA",
    ],
  },
  {
    id: "founder",
    name: "Kit Vision Founder",
    price: "$600",
    icon: Crown,
    highlight: true,
    badge: "1.000 vagas limite",
    items: [
      "1 óculos inteligente Bluetooth Aether Vision",
      `${formatVision(visionFromUsd(600))} $VISION (US$ 600 ÷ ${formatUsd(VISION_PRICE_USD)})`,
      "Assinatura vitalícia do app de IA + 10.000 $AETH na mainnet",
    ],
  },
] as const;

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
    title: "Aether Vision, o primeiro modelo",
    body: "Simples, altamente funcional e focado em entregar excelentes recursos com custo acessível — o ponto de entrada da rede wearable.",
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

function AetherVisionMockup() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-neon/35 bg-surface/50 p-6 shadow-[0_0_80px_rgba(0,242,254,0.08)] backdrop-blur-xl sm:p-10 xl:h-full">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.14),transparent_58%),radial-gradient(ellipse_at_bottom,rgba(157,78,221,0.12),transparent_50%)]" />

      <div className="relative mb-8 flex justify-center">
        <span className="aether-live inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-onyx/80 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300 sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-neon" />
          Live Preview / Wearable Ready
        </span>
      </div>

      <div
        className="relative mx-auto flex max-w-xl items-center justify-center py-6 sm:py-10"
        style={{ perspective: "920px" }}
        aria-hidden
      >
        <div
          className="flex w-full items-center justify-center"
          style={{ transform: "rotateX(8deg) rotateY(-6deg)" }}
        >
          <div className="relative h-[8px] w-8 shrink-0 rounded-l-full bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-500 shadow-[0_8px_16px_rgba(0,0,0,0.45)] sm:h-[10px] sm:w-24">
            <span className="aether-led absolute -top-1 right-2 h-1.5 w-1.5 rounded-full bg-neon sm:right-6 sm:h-2 sm:w-2" />
            <span className="aether-led absolute top-2.5 right-3 h-1 w-1 rounded-full bg-violet [animation-delay:0.4s] sm:top-3 sm:right-10 sm:h-1.5 sm:w-1.5" />
          </div>

          <div className="relative flex items-center gap-1 sm:gap-1.5">
            <div className="relative h-16 w-[5.5rem] rounded-[46%_46%_48%_48%/42%_42%_58%_58%] border border-neon/50 bg-zinc-950/80 p-[5px] shadow-[0_0_24px_rgba(0,242,254,0.18)] sm:h-24 sm:w-36">
              <div className="aether-lens h-full w-full rounded-[inherit] border border-white/10" />
            </div>
            <div className="h-2 w-6 rounded-full bg-gradient-to-b from-zinc-300/80 to-zinc-600 sm:w-8" />
            <div className="relative h-16 w-[5.5rem] rounded-[46%_46%_48%_48%/42%_42%_58%_58%] border border-neon/50 bg-zinc-950/80 p-[5px] shadow-[0_0_24px_rgba(0,242,254,0.18)] sm:h-24 sm:w-36">
              <div className="aether-lens h-full w-full rounded-[inherit] border border-white/10 [animation-delay:1.2s]" />
            </div>
          </div>

          <div className="relative h-[8px] w-8 shrink-0 rounded-r-full bg-gradient-to-l from-zinc-800 via-zinc-600 to-zinc-500 shadow-[0_8px_16px_rgba(0,0,0,0.45)] sm:h-[10px] sm:w-24">
            <span className="aether-led absolute -top-1 left-2 h-1.5 w-1.5 rounded-full bg-neon [animation-delay:0.2s] sm:left-6 sm:h-2 sm:w-2" />
            <span className="aether-led absolute top-2.5 left-3 h-1 w-1 rounded-full bg-violet [animation-delay:0.7s] sm:top-3 sm:left-10 sm:h-1.5 sm:w-1.5" />
          </div>
        </div>
      </div>

      <div className="relative mt-2 text-center">
        <p className="font-display text-xl tracking-tight sm:text-2xl">
          Aether Vision
        </p>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          Onyx chassis · lentes fumê · IA nas hastes
        </p>
      </div>
    </div>
  );
}

function VisionCalculator() {
  const [solInput, setSolInput] = useState("2");
  const [solUsd, setSolUsd] = useState(FALLBACK_SOL_USD);
  const [priceSource, setPriceSource] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    let cancelled = false;

    async function loadSolPrice() {
      try {
        const response = await fetch("/api/sol-price", { cache: "no-store" });
        if (!response.ok) throw new Error("price endpoint failed");
        const data = (await response.json()) as { usd?: number; source?: string };
        if (
          cancelled ||
          typeof data.usd !== "number" ||
          !Number.isFinite(data.usd) ||
          data.usd <= 0
        ) {
          return;
        }
        setSolUsd(data.usd);
        setPriceSource(data.source === "fallback" ? "fallback" : "live");
      } catch {
        if (!cancelled) {
          setSolUsd(FALLBACK_SOL_USD);
          setPriceSource("fallback");
        }
      }
    }

    void loadSolPrice();
    const interval = window.setInterval(() => {
      void loadSolPrice();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const quote = useMemo(() => {
    const solAmount = Number.parseFloat(solInput.replace(",", "."));
    if (!Number.isFinite(solAmount) || solAmount <= 0) {
      return { solAmount: 0, usd: 0, vision: 0 };
    }
    const usd = solAmount * solUsd;
    return { solAmount, usd, vision: visionFromUsd(usd) };
  }, [solInput, solUsd]);

  return (
    <article className="mt-8 rounded-3xl border border-line bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-xl">Calculadora $VISION</h3>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Preço oficial da pré-venda:{" "}
            <span className="text-neon">1 $VISION = {formatUsd(VISION_PRICE_USD)}</span>. Digite o SOL
            a enviar; a conversão usa a cotação ao vivo e divide por 0,05.
          </p>
        </div>
        <p className="text-xs text-muted">
          SOL ≈ {formatUsd(solUsd)}
          {priceSource === "live" ? " · cotação ao vivo" : " · fallback US$ 150"}
        </p>
      </div>

      <label className="mt-6 block text-sm text-muted" htmlFor="sol-amount">
        Quantidade em SOL
      </label>
      <input
        id="sol-amount"
        inputMode="decimal"
        value={solInput}
        onChange={(event) => setSolInput(event.target.value)}
        placeholder="2"
        className="mt-2 w-full rounded-2xl border border-line bg-onyx px-4 py-3 text-ink outline-none ring-neon focus:ring-2"
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-onyx p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">SOL</p>
          <p className="mt-2 font-display text-2xl text-ink">
            {formatVision(quote.solAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-onyx p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">USD investido</p>
          <p className="mt-2 font-display text-2xl text-violet">
            {formatUsd(quote.usd)}
          </p>
        </div>
        <div className="rounded-2xl border border-neon/40 bg-onyx p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Você recebe $VISION
          </p>
          <p className="mt-2 font-display text-2xl text-neon">
            {formatVision(quote.vision)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        {formatVision(quote.solAmount)} SOL × {formatUsd(solUsd)} ={" "}
        {formatUsd(quote.usd)} ÷ {formatUsd(VISION_PRICE_USD)} = {formatVision(quote.vision)} $VISION.
        Contribua na vault Squads após conferir o endereço.
      </p>
    </article>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyVaultAddress() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SQUADS_VAULT);
        return;
      }
    } catch {
      /* fallback below */
    }

    const input = document.createElement("textarea");
    input.value = SQUADS_VAULT;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line/80 bg-onyx/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a
            href="#topo"
            className="font-display text-lg font-semibold tracking-[0.22em]"
          >
            <span className="bg-gradient-to-r from-neon via-violet to-neon bg-clip-text text-transparent">
              AETHER
            </span>
          </a>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Principal">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted transition hover:text-neon"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full border border-line p-2 text-muted transition hover:border-neon hover:text-neon sm:inline-flex"
              aria-label="X @VISIONAETH"
            >
              <X size={16} />
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="hidden rounded-full border border-line p-2 text-muted transition hover:border-neon hover:text-neon sm:inline-flex"
              aria-label="E-mail de suporte"
            >
              <Mail size={16} />
            </a>
            <a
              href="#presale"
              className="glow-neon hidden rounded-full bg-neon px-4 py-2 text-sm font-medium text-onyx md:inline-flex"
            >
              Garantir Kit
            </a>
            <button
              type="button"
              className="inline-flex rounded-full border border-line p-2 text-ink lg:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            className="border-t border-line px-5 py-4 lg:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col gap-3">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted"
              >
                X @VISIONAETH
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-muted">
                {SUPPORT_EMAIL}
              </a>
              <a
                href="#presale"
                className="glow-neon mt-2 inline-flex w-fit rounded-full bg-neon px-4 py-2 text-sm font-medium text-onyx"
                onClick={() => setMenuOpen(false)}
              >
                Garantir Kit
              </a>
            </div>
          </nav>
        ) : null}
      </header>

      <main>
        <section
          id="topo"
          className="grid-aether relative scroll-mt-24 overflow-hidden border-b border-line"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,242,254,0.14),transparent_52%),radial-gradient(ellipse_at_bottom_right,rgba(157,78,221,0.18),transparent_46%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1.15fr_0.85fr] md:py-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] text-neon">
                <Sparkles size={12} />
                Solana DePIN + AI Wearable Network
              </p>
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                Aether Vision
                <span className="mt-2 block bg-gradient-to-r from-neon via-violet to-electric bg-clip-text text-transparent">
                  óculos inteligentes, app de IA e real yield
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                O primeiro modelo é simples, funcional e acessível. Assinaturas
                do app de IA aceitam $VISION e $AETH. Com as vendas, buyback
                automático queima os dois tokens e reabastece o caixa para a
                próxima geração de hardware.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href="#presale"
                  className="glow-neon rounded-full bg-neon px-6 py-3 text-sm font-medium text-onyx"
                >
                  Ver Kits da Pré-venda
                </a>
                <a
                  href="#hardware"
                  className="rounded-full border border-line px-6 py-3 text-sm text-ink transition hover:border-neon hover:text-neon"
                >
                  Especificações do Hardware
                </a>
              </div>
            </div>

            <div className="relative mx-auto min-w-0 w-full max-w-md">
              <div className="glow-neon overflow-hidden rounded-3xl border border-line bg-surface/80 p-6 sm:p-8">
                <Glasses className="mb-6 text-neon" size={42} />
                <p className="font-display text-2xl">Aether Vision</p>
                <p className="mt-2 text-sm text-muted">
                  AI glasses · open-ear · App Bridge · Onyx chassis
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted">App</dt>
                    <dd className="mt-1 text-ink">$VISION + $AETH</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Yield</dt>
                    <dd className="mt-1 text-neon">Buyback & Burn</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Token</dt>
                    <dd className="mt-1 text-ink">1B $VISION</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Vault</dt>
                    <dd className="mt-1 text-ink">Squads Multisig</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section id="presale" className="scroll-mt-24 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
            <p className="text-xs uppercase tracking-[0.22em] text-neon">
              Pré-venda · Vouchers de consumo
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              Kits Hardware + Tokens
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Preço oficial: <span className="text-neon">{formatUsd(VISION_PRICE_USD)}</span> por 1
              $VISION. Crédito antecipado de licença de uso do app e/ou do
              hardware. Assinaturas mensais aceitam nativamente{" "}
              <span className="text-ink">$AETH</span> e{" "}
              <span className="text-ink">$VISION</span>.
            </p>

            <article className="mt-10 rounded-3xl border border-line bg-surface p-6 md:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    Carteira Squads Multisig transparente
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-ink">
                    {SQUADS_VAULT}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm text-muted">
                    Vault público do projeto para investidores e apoiadores
                    acompanharem o caixa e realizarem as contribuições da
                    pré-venda. Confira o endereço na carteira antes de assinar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyVaultAddress}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-ink transition hover:border-neon hover:text-neon"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copiado" : "Copiar Endereço"}
                </button>
              </div>
              {copied ? (
                <p className="mt-3 text-xs text-neon" role="status">
                  Endereço copiado para a área de transferência.
                </p>
              ) : null}
            </article>

            <VisionCalculator />

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {KITS.map((kit) => (
                <article
                  key={kit.id}
                  className={`flex flex-col rounded-3xl border bg-surface p-6 transition duration-300 hover:border-neon hover:shadow-[0_0_28px_rgba(0,242,254,0.12)] ${
                    kit.highlight
                      ? "border-violet/70 shadow-[0_0_32px_rgba(157,78,221,0.16)]"
                      : "border-line"
                  }`}
                >
                  <kit.icon
                    className={kit.highlight ? "text-violet" : "text-neon"}
                    size={22}
                  />
                  <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted">
                    {kit.badge}
                  </p>
                  <h3 className="mt-2 font-display text-xl">{kit.name}</h3>
                  <p className="mt-1 font-display text-3xl text-neon">{kit.price}</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm leading-relaxed text-muted">
                    {kit.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neon" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`#presale`}
                    className={`mt-6 inline-flex justify-center rounded-full px-4 py-2 text-sm font-medium transition ${
                      kit.highlight
                        ? "bg-violet text-ink hover:opacity-90"
                        : "border border-line text-ink hover:border-neon hover:text-neon"
                    }`}
                  >
                    Selecionar {kit.name.replace("Kit Vision ", "")}
                  </a>
                </article>
              ))}
            </div>

            <p className="mt-6 rounded-2xl border border-line bg-onyx px-4 py-3 text-sm text-muted">
              Pagamento das assinaturas mensais do aplicativo:{" "}
              <span className="text-ink">$AETH</span> e{" "}
              <span className="text-ink">$VISION</span> são aceitos nativamente.
            </p>
          </div>
        </section>

        <section id="hardware" className="scroll-mt-24 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
            <p className="text-xs uppercase tracking-[0.22em] text-neon">
              Hardware
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              Aether Vision
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Primeiro modelo da linha: wearable Bluetooth com App Bridge,
              vidro fumê e IA nas hastes — função no centro, custo acessível.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-12 xl:grid-rows-2">
              <div className="order-first sm:col-span-2 xl:col-span-6 xl:col-start-4 xl:row-span-2">
                <AetherVisionMockup />
              </div>
              {HARDWARE.map((item, index) => {
                const placement =
                  index === 0
                    ? "xl:col-span-3 xl:col-start-1 xl:row-start-1"
                    : index === 1
                      ? "xl:col-span-3 xl:col-start-1 xl:row-start-2"
                      : index === 2
                        ? "xl:col-span-3 xl:col-start-10 xl:row-start-1"
                        : "xl:col-span-3 xl:col-start-10 xl:row-start-2";

                return (
                  <article
                    key={item.title}
                    className={`rounded-3xl border border-line bg-surface p-6 transition duration-300 hover:border-neon hover:shadow-[0_0_28px_rgba(0,242,254,0.12)] ${placement}`}
                  >
                    <item.icon className="text-neon" size={22} />
                    <h3 className="mt-4 font-display text-lg leading-snug md:text-xl">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="visao" className="scroll-mt-24 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
            <p className="text-xs uppercase tracking-[0.22em] text-violet">
              Visão do produto
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              Estratégia de valorização AETHER
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Hardware acessível agora, tesouraria transparente, e um ciclo em
              que vendas alimentam queima de tokens e o próximo modelo.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {VISION_POINTS.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-line bg-surface p-6 transition duration-300 hover:border-violet"
                >
                  <h3 className="font-display text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tokenomics" className="scroll-mt-24 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
            <p className="text-xs uppercase tracking-[0.22em] text-neon">
              Tokenomics transparente
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              $VISION · 1.000.000.000
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Supply fixo de 1 bilhão. Pré-venda entre 10% e 20% a $0,05.
              Liquidez, recompensas do app e time com alocação pública.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {TOKENOMICS.map((item) => (
                <article
                  key={item.label}
                  className="rounded-3xl border border-line bg-surface p-6 transition duration-300 hover:border-neon"
                >
                  <item.icon className="text-neon" size={20} />
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted">
                    {item.label}
                  </p>
                  <p className="mt-2 font-display text-2xl text-ink">{item.value}</p>
                  <p className="mt-2 text-sm text-muted">{item.detail}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted">
              $AETH entra na mainnet nativa; $VISION opera o app e a liquidez na
              Solana. Ambos entram no ciclo de Buyback & Burn após o primeiro
              lote.
            </p>
          </div>
        </section>

        <section id="desenvolvimento" className="scroll-mt-24 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
            <p className="text-xs uppercase tracking-[0.22em] text-neon">
              Desenvolvimento & atualizações
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              Build constante, no X oficial
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Não publicamos um roadmap estático. As atualizações de
              desenvolvimento são contínuas e saem no canal oficial{" "}
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                className="text-neon transition hover:underline"
              >
                @VISIONAETH
              </a>
              .
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PILLARS.map((item, index) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-line bg-surface p-6 transition duration-300 hover:border-neon"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-violet">
                    Pilar {index + 1}
                  </p>
                  <item.icon className="mt-4 text-neon" size={22} />
                  <h3 className="mt-4 font-display text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display tracking-[0.22em] text-neon">AETHER</p>
            <p className="mt-3 max-w-sm text-sm text-muted">
              © 2026 Aether Vision. Todos os direitos reservados.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-neon"
            >
              <X size={16} />
              @VISIONAETH
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-neon"
            >
              <Mail size={16} />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-10 text-xs leading-relaxed text-muted">
          A aquisição de Vouchers/Kits na pré-venda representa a compra
          antecipada de licenças de uso do aplicativo de inteligência
          artificial e/ou dispositivos físicos, não constituindo oferta pública
          de valores mobiliários ou investimentos financeiros especulativos.
        </p>
      </footer>
    </>
  );
}
