"use client";

import { motion, useReducedMotion } from "framer-motion";
import { toPng } from "html-to-image";
import { Check, Copy, Download, Loader2, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  joinPt,
  type ArchetypeProfile,
  type NarrativeResult,
} from "@/src/data/archetypes";
import {
  buildDiagnosis,
  formatDiagnosisShareText,
} from "@/src/data/diagnosis";
import { TOTAL_QUESTIONS } from "@/src/data/scoring";
import { OrnateCorners, SanctuaryBackdrop } from "./CinematicChrome";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  ShareCardTemplate,
} from "./ShareCardTemplate";

type Props = {
  result: NarrativeResult;
  onRestart: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

function DominantCard({
  profile,
  className = "",
  badge,
}: {
  profile: ArchetypeProfile;
  className?: string;
  badge?: string;
}) {
  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden rounded-sm border border-[color:var(--cine-border)] shadow-[0_18px_40px_rgba(0,0,0,0.45),0_0_28px_rgba(196,60,60,0.12)] ${className}`}
    >
      <Image
        src={profile.image}
        alt={profile.title}
        fill
        sizes="(max-width: 640px) 80vw, 320px"
        className="object-cover"
        priority
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg, transparent 42%, rgba(5,6,8,0.82) 78%, rgba(5,6,8,0.95) 100%),
            linear-gradient(0deg, transparent 70%, rgba(5,6,8,0.35) 100%)
          `,
          boxShadow: `inset 0 0 0 1px ${profile.accent}44`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 p-4 text-center sm:p-5">
        <p
          className="cart-display text-[10px] uppercase tracking-[0.28em]"
          style={{ color: profile.accent }}
        >
          {badge ?? "Brasão"}
        </p>
        <h2 className="cart-display mt-1.5 text-xl tracking-wide text-[color:var(--cine-ink)] sm:text-2xl">
          {profile.title}
        </h2>
        <p className="mt-1 text-xs text-[color:var(--cine-muted)]">
          {profile.subtitle}
        </p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      className="cart-card mt-8 rounded-sm p-6"
    >
      <h3 className="cart-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
        {title}
      </h3>
      <div className="mt-4 text-sm leading-relaxed text-[color:var(--cart-muted)]">
        {children}
      </div>
    </motion.div>
  );
}

export function QuizResult({ result, onRestart }: Props) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const diagnosis = useMemo(() => buildDiagnosis(result), [result]);
  const principal = result.primary;
  const sub = diagnosis.sub;

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(
        formatDiagnosisShareText(result, diagnosis),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function downloadShareImage() {
    const node = shareCardRef.current;
    if (!node || sharing) return;
    setSharing(true);
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const dataUrl = await toPng(node, {
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        pixelRatio: 1,
        cacheBust: true,
        style: {
          transform: "none",
        },
      });

      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `arquetipo-${principal.id}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const shareText = `${diagnosis.confluenceTitle} — ${principal.title} ${diagnosis.dominantPct}% · ${sub.title} ${diagnosis.secondaryPct}%`;

      const canFileShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canFileShare) {
        try {
          await navigator.share({
            files: [file],
            title: "Meu Arquétipo",
            text: shareText,
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }

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
      // silent — button returns to idle
    } finally {
      setSharing(false);
    }
  }

  const modeLabel =
    diagnosis.confluenceMode === "potencializa"
      ? "potencializa"
      : diagnosis.confluenceMode === "tensiona"
        ? "tensiona"
        : "equilibra";

  return (
    <section className="cine-sanctuary-band relative mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-16 pt-12">
      <SanctuaryBackdrop opacity={0.25} />
      <div className="relative z-10">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="cart-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]"
        >
          Dossiê Personalizado
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.98, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
          className="mx-auto mt-8"
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <DominantCard
              profile={principal}
              badge={`Dominante · ${diagnosis.dominantPct}%`}
            />
            <DominantCard
              profile={sub}
              badge={`Sub · ${diagnosis.secondaryPct}%`}
            />
          </div>
          <p className="cart-display mt-5 text-center text-[10px] uppercase tracking-[0.32em] text-[color:var(--cart-muted)]">
            Confluência Central
          </p>
        </motion.div>

        <SectionCard title="1. Arquétipo Dominante & Subarquétipo" delay={0.12}>
          <p className="cart-display text-xl tracking-wide text-[color:var(--cart-ink)]">
            {diagnosis.confluenceTitle}
          </p>
          <p className="mt-3">
            A combinação{" "}
            <strong className="font-medium text-[color:var(--cart-ink)]">
              {modeLabel}
            </strong>{" "}
            o perfil. {diagnosis.confluenceText}
          </p>
        </SectionCard>

        <SectionCard title="2. Espelho das Suas Escolhas" delay={0.16}>
          <p>{diagnosis.mirror}</p>
          {diagnosis.topTags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {diagnosis.topTags.map((t) => (
                <li
                  key={t.tag}
                  className="border border-[color:var(--cart-border-soft)] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-[color:var(--cart-copper)]"
                >
                  {t.label} · {t.count}×
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="3. Pontos Fortes (Sua Luz em Ação)" delay={0.2}>
          <p>{diagnosis.strengths}</p>
        </SectionCard>

        <SectionCard
          title="4. Pontos Fracos (Gatilhos de Autossabotagem)"
          delay={0.24}
        >
          <p>{diagnosis.weaknesses}</p>
        </SectionCard>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.28 }}
          className="cart-card mt-8 rounded-sm p-6"
          style={{
            boxShadow: `0 0 36px ${principal.accent}18, 0 18px 40px rgba(0,0,0,0.4)`,
          }}
        >
          <OrnateCorners className="p-1">
            <h3 className="cart-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
              5. A Sombra
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--cart-muted)]">
              {diagnosis.shadow}
            </p>
            <p className="cart-display mt-6 text-[11px] uppercase tracking-[0.18em] text-[color:var(--cart-copper)]">
              3 Passos Práticos de Integração
            </p>
            <ol className="mt-3 space-y-3 text-sm leading-relaxed text-[color:var(--cart-ink)]/85">
              {diagnosis.integrationSteps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="cart-display text-[color:var(--cart-copper)]">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </OrnateCorners>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.32 }}
          className="cart-card mt-8 overflow-hidden rounded-sm"
        >
          <div className="border-b border-[color:var(--cart-border-soft)] px-4 py-3">
            <h3 className="cart-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
              Pontuação Híbrida (Primário +3 · Secundário +1)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--cart-border-soft)] text-[11px] uppercase tracking-[0.14em] text-[color:var(--cart-dim)]">
                  <th className="px-4 py-3 font-medium">Arquétipo</th>
                  <th className="px-4 py-3 font-medium">Pontos</th>
                  <th className="px-4 py-3 font-medium">Afinidade</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                </tr>
              </thead>
              <tbody>
                {result.dominants.map((d) => (
                  <tr
                    key={d.profile.id}
                    className="border-b border-[color:var(--cart-border-soft)] align-top"
                  >
                    <td className="px-4 py-3 font-semibold text-[color:var(--cart-ink)]">
                      {d.profile.title}
                    </td>
                    <td className="px-4 py-3 tabular text-[color:var(--cart-copper)]">
                      {d.score} pts
                    </td>
                    <td className="px-4 py-3 tabular text-[color:var(--cart-muted)]">
                      {d.affinityPct}%
                    </td>
                    <td className="px-4 py-3 text-[color:var(--cart-muted)]">
                      {d.profile.dominantRole}
                    </td>
                  </tr>
                ))}
                {result.secondaries.map((s) => (
                  <tr
                    key={s.profile.id}
                    className="border-b border-[color:var(--cart-border-soft)] align-top"
                  >
                    <td className="px-4 py-3 font-semibold text-[color:var(--cart-ink)]">
                      {s.profile.title}
                    </td>
                    <td className="px-4 py-3 tabular text-[color:var(--cart-muted)]">
                      {s.score} pts
                    </td>
                    <td className="px-4 py-3 tabular text-[color:var(--cart-dim)]">
                      {s.affinityPct}%
                    </td>
                    <td className="px-4 py-3 text-[color:var(--cart-muted)]">
                      {s.profile.subRole}
                    </td>
                  </tr>
                ))}
                {result.complementary.length > 0 && (
                  <tr className="align-top">
                    <td className="px-4 py-3 text-[color:var(--cart-ink)]/85">
                      {result.complementary
                        .map((c) => c.profile.title)
                        .join(" / ")}
                    </td>
                    <td className="px-4 py-3 tabular text-[color:var(--cart-dim)]">
                      {result.complementary.map((c) => c.score).join(", ")} pts
                    </td>
                    <td className="px-4 py-3 tabular text-[color:var(--cart-dim)]">
                      —
                    </td>
                    <td className="px-4 py-3 text-[color:var(--cart-dim)]">
                      Traços de{" "}
                      {joinPt(
                        result.complementary.map((c) => c.profile.traitKeyword),
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <p className="mt-8 text-center text-xs text-[color:var(--cart-dim)]">
          Escala híbrida · até {TOTAL_QUESTIONS * 3} pts teóricos por arquétipo
          (sempre primário)
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void downloadShareImage()}
            disabled={sharing}
            className="cart-cta inline-flex w-full items-center justify-center gap-2 rounded-sm px-5 py-3.5 text-sm font-semibold disabled:opacity-60"
          >
            {sharing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {sharing ? "Gerando imagem…" : "Baixar Imagem"}
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-5 py-3.5 text-sm text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)]"
            >
              <RotateCcw size={16} />
              Nova Expedição
            </button>
            <button
              type="button"
              onClick={copyResult}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-5 py-3.5 text-sm text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)]"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado" : "Copiar Dossiê Completo"}
            </button>
          </div>
        </div>
      </div>

      <ShareCardTemplate result={result} cardRef={shareCardRef} />
    </section>
  );
}
