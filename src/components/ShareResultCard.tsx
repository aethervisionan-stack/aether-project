"use client";

import { useRef, useState, type Ref } from "react";
import { Download, Loader2 } from "lucide-react";
import { participantInitials } from "@/src/lib/avatarImage";
import {
  formatTopPercentLabel,
  modePublicLabel,
} from "@/src/lib/challengeInvite";
import type { AssessmentMode } from "@/src/types/quiz";

export const IQ_SHARE_CARD_WIDTH = 1080;
export const IQ_SHARE_CARD_HEIGHT = 1350;

export type ShareResultCardData = {
  name: string;
  avatarUrl?: string | null;
  iq: number;
  marginOfError: number;
  percentile: number;
  rank: number | null;
  mode: AssessmentMode;
  /** 0–100 reliability / precision for credibility seal */
  credibilityScore: number;
};

function credibilitySeal(score: number): {
  label: string;
  sub: string;
  tone: string;
} {
  if (score >= 80) {
    return {
      label: "Selo de credibilidade",
      sub: "Alta confiabilidade da sessão",
      tone: "#34d399",
    };
  }
  if (score >= 55) {
    return {
      label: "Selo de credibilidade",
      sub: "Confiabilidade moderada",
      tone: "#fbbf24",
    };
  }
  return {
    label: "Selo de credibilidade",
    sub: "Interprete com cautela",
    tone: "#fb923c",
  };
}

/**
 * Off-screen export surface for html-to-image (inline styles, no SSR APIs).
 */
export function ShareResultCardSurface({
  data,
  cardRef,
}: {
  data: ShareResultCardData;
  cardRef: Ref<HTMLDivElement>;
}) {
  const seal = credibilitySeal(data.credibilityScore);
  const topLabel = formatTopPercentLabel(data.percentile);
  const initials = participantInitials(data.name);
  const rankLabel =
    data.rank != null ? `#${data.rank}` : "Sem ranking";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -14000,
        top: 0,
        width: IQ_SHARE_CARD_WIDTH,
        height: IQ_SHARE_CARD_HEIGHT,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <div
        ref={cardRef}
        data-iq-share-card
        style={{
          width: IQ_SHARE_CARD_WIDTH,
          height: IQ_SHARE_CARD_HEIGHT,
          position: "relative",
          overflow: "hidden",
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 12%, rgba(16,185,129,0.22) 0%, transparent 48%), radial-gradient(ellipse at 78% 18%, rgba(99,102,241,0.18) 0%, transparent 42%), linear-gradient(165deg, #0c0c10 0%, #09090b 55%, #06110c 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            boxSizing: "border-box",
            padding: "72px 64px 56px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 18,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#34d399",
              fontWeight: 600,
            }}
          >
            Teste de QI Profissional
          </p>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 16,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#71717a",
            }}
          >
            Resultado certificado · {modePublicLabel(data.mode)}
          </p>

          <div
            style={{
              marginTop: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
            }}
          >
            {data.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatarUrl}
                alt=""
                width={168}
                height={168}
                crossOrigin="anonymous"
                style={{
                  width: 168,
                  height: 168,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid rgba(52,211,153,0.55)",
                  boxShadow: "0 0 0 8px rgba(52,211,153,0.12)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 168,
                  height: 168,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#18181b",
                  border: "3px solid rgba(52,211,153,0.45)",
                  boxShadow: "0 0 0 8px rgba(52,211,153,0.1)",
                  fontSize: 52,
                  fontWeight: 600,
                  color: "#e4e4e7",
                  letterSpacing: "0.04em",
                }}
              >
                {initials}
              </div>
            )}
            <h1
              style={{
                margin: 0,
                fontSize: 42,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                textAlign: "center",
                color: "#fafafa",
              }}
            >
              {data.name}
            </h1>
          </div>

          <div
            style={{
              marginTop: 48,
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 18,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#71717a",
              }}
            >
              QI estimado
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 120,
                fontWeight: 650,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: "#fafafa",
              }}
            >
              {data.iq}
              <span
                style={{
                  marginLeft: 16,
                  fontSize: 36,
                  fontWeight: 500,
                  color: "#a1a1aa",
                }}
              >
                (±{data.marginOfError})
              </span>
            </p>
          </div>

          <div
            style={{
              marginTop: 48,
              width: "100%",
              maxWidth: 880,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 20,
            }}
          >
            {[
              {
                k: "Percentil",
                v: topLabel,
                s: `${data.percentile.toFixed(1)}º`,
              },
              { k: "Ranking", v: rankLabel, s: "posição local" },
              {
                k: "Modo",
                v: modePublicLabel(data.mode),
                s: "bateria aplicada",
              },
            ].map((cell) => (
              <div
                key={cell.k}
                style={{
                  borderRadius: 20,
                  border: "1px solid #27272a",
                  background: "rgba(24,24,27,0.72)",
                  padding: "28px 20px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#71717a",
                  }}
                >
                  {cell.k}
                </p>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 32,
                    fontWeight: 600,
                    color: "#f4f4f5",
                  }}
                >
                  {cell.v}
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 14,
                    color: "#71717a",
                  }}
                >
                  {cell.s}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "auto",
              width: "100%",
              maxWidth: 720,
              borderRadius: 999,
              border: `1px solid ${seal.tone}55`,
              background: `${seal.tone}14`,
              padding: "22px 36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: seal.tone,
                boxShadow: `0 0 0 6px ${seal.tone}22`,
                flexShrink: 0,
              }}
            />
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: seal.tone,
                  letterSpacing: "0.04em",
                }}
              >
                {seal.label}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 15,
                  color: "#a1a1aa",
                }}
              >
                {seal.sub} · índice {Math.round(data.credibilityScore)}/100
              </p>
            </div>
          </div>

          <p
            style={{
              margin: "28px 0 0",
              fontSize: 14,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#52525b",
            }}
          >
            Estimativa digital · não é laudo clínico
          </p>
        </div>
      </div>
    </div>
  );
}

/** Visible preview + PNG download (html-to-image loaded only in the browser). */
export function ShareResultCard({ data }: { data: ShareResultCardData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seal = credibilitySeal(data.credibilityScore);
  const topLabel = formatTopPercentLabel(data.percentile);

  async function downloadPng() {
    if (typeof window === "undefined" || busy) return;
    const node = cardRef.current;
    if (!node) return;
    setBusy(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const dataUrl = await toPng(node, {
        width: IQ_SHARE_CARD_WIDTH,
        height: IQ_SHARE_CARD_HEIGHT,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none" },
      });
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `qi-${data.name.replace(/\s+/g, "-").toLowerCase().slice(0, 24)}-${data.iq}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="iq-share-card-heading"
      className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="iq-share-card-heading"
            className="text-sm font-semibold text-zinc-100 sm:text-base"
          >
            Cartão para compartilhar
          </h2>
          <p className="text-sm text-zinc-500">
            Avatar, QI, percentil, ranking e selo de credibilidade — baixe em
            PNG.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void downloadPng()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/60 hover:bg-emerald-500/15 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {busy ? "Gerando PNG…" : "Baixar PNG"}
        </button>
      </div>

      {/* Live preview (responsive) */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/40 p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-500/45 ring-offset-2 ring-offset-zinc-950 sm:h-20 sm:w-20"
            />
          ) : (
            <span
              aria-hidden
              className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-medium text-zinc-200 ring-2 ring-emerald-500/35 ring-offset-2 ring-offset-zinc-950 sm:h-20 sm:w-20 sm:text-base"
            >
              {participantInitials(data.name)}
            </span>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {modePublicLabel(data.mode)}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-50">{data.name}</p>
            <p className="mt-2 font-iq-display text-4xl tabular-nums text-zinc-50 sm:text-5xl">
              {data.iq}
              <span className="ml-2 text-base font-normal text-zinc-400 sm:text-lg">
                (±{data.marginOfError})
              </span>
            </p>
          </div>
          <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Percentil
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {topLabel}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Ranking
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {data.rank != null ? `#${data.rank}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Selo
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: seal.tone }}
              >
                {Math.round(data.credibilityScore)}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">{seal.sub}</p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-amber-400" role="alert">
          {error}
        </p>
      ) : null}

      <ShareResultCardSurface data={data} cardRef={cardRef} />
    </section>
  );
}
