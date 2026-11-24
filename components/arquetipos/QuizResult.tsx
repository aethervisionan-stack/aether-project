"use client";

import { motion, useReducedMotion } from "framer-motion";
import { toPng } from "html-to-image";
import { Check, Copy, Download, Loader2, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  TOTAL_QUESTIONS,
  buildIntro,
  formatShareText,
  joinPt,
  type ArchetypeProfile,
  type NarrativeResult,
} from "@/src/data/archetypes";
import { OrnateCorners, SanctuaryBackdrop } from "./CinematicChrome";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  ShareCardTemplate,
} from "./ShareCardTemplate";

type Props = {
  result: NarrativeResult;
  onRestart: () => void;
  /** When true, real result stays behind blur as curiosity bait (Opção 1). */
  locked?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

function DominantCard({
  profile,
  className = "",
}: {
  profile: ArchetypeProfile;
  className?: string;
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
          Brasão
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

function SecondaryThumb({ profile }: { profile: ArchetypeProfile }) {
  return (
    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-sm border border-[color:var(--cine-border-soft)]">
      <Image
        src={profile.image}
        alt={profile.title}
        fill
        sizes="56px"
        className="object-cover"
      />
    </div>
  );
}

export function QuizResult({ result, onRestart, locked = false }: Props) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const intro = useMemo(() => buildIntro(result), [result]);
  const principal = result.primary;
  /** Semi-revealed hook — first words of the archetype title to spark curiosity */
  const titleHook = principal.title.slice(0, Math.min(8, principal.title.length));
  const titleRest = principal.title.slice(titleHook.length);

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(formatShareText(result));
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
      // Wait a frame so off-screen portraits are painted
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
      const shareText = buildIntro(result);

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
          // User cancel → stop; other errors fall through to download
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

  return (
    <section
      className={`cine-sanctuary-band relative mx-auto w-full max-w-2xl px-5 pt-12 ${
        locked
          ? "h-[calc(100dvh-3.5rem)] min-h-[28rem] overflow-hidden pb-8 sm:h-[calc(100dvh-4rem)]"
          : "min-h-[100dvh] pb-16"
      }`}
    >
      <SanctuaryBackdrop opacity={0.25} />

      {/* Sharp curiosity hook ABOVE the blurred layer (not inside filter) */}
      {locked ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="pointer-events-none relative z-20 mb-3 select-none text-center"
          aria-hidden
        >
          <p className="cart-display text-[10px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]">
            Seu arquétipo
          </p>
          <p className="cart-display mt-1.5 text-xl tracking-wide text-[color:var(--cine-ink)] sm:text-2xl">
            <span>{titleHook}</span>
            <span className="inline-block blur-[5px] opacity-60">
              {titleRest || "…"}
            </span>
            <span className="ml-0.5 inline-block animate-pulse text-[color:var(--cart-copper)]">
              …
            </span>
          </p>
        </motion.div>
      ) : null}

      {/* Real result stays mounted — blurred bait while !isPaid / locked */}
      <motion.div
        className={`relative z-10 ${locked ? "select-none" : ""}`}
        animate={
          locked
            ? { filter: "blur(8px)", opacity: 0.92 }
            : { filter: "blur(0px)", opacity: 1 }
        }
        transition={{ duration: reduce ? 0.2 : 0.65, ease: EASE }}
        style={{
          backdropFilter: locked ? "blur(8px)" : "blur(0px)",
          WebkitBackdropFilter: locked ? "blur(8px)" : "blur(0px)",
          pointerEvents: locked ? "none" : "auto",
          userSelect: locked ? "none" : "auto",
        }}
        aria-hidden={locked || undefined}
      >
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="cart-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]"
        >
          Relatório de Expedição
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.98, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
          className="mx-auto mt-8"
        >
          {result.hybrid ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {result.dominants.map((d) => (
                <DominantCard key={d.profile.id} profile={d.profile} />
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-[280px] sm:max-w-[320px]">
              <DominantCard profile={principal} />
            </div>
          )}
          <p className="cart-display mt-5 text-center text-[10px] uppercase tracking-[0.32em] text-[color:var(--cart-muted)]">
            {result.hybrid ? "Pergaminho Híbrido" : "Pergaminho Dominante"}
          </p>
        </motion.div>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.12 }}
          className="mt-10 text-base leading-relaxed text-[color:var(--cart-muted)]"
        >
          {intro}
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.16 }}
          className="cart-card mt-10 overflow-hidden rounded-sm"
        >
          <div className="border-b border-[color:var(--cart-border-soft)] px-4 py-3">
            <h3 className="cart-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
              Registro Completo da Expedição
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--cart-border-soft)] text-[11px] uppercase tracking-[0.14em] text-[color:var(--cart-dim)]">
                  <th className="px-4 py-3 font-medium">Arquétipo</th>
                  <th className="px-4 py-3 font-medium">Pontos</th>
                  <th className="px-4 py-3 font-medium">Papel no Seu Perfil</th>
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
                      {result.complementary.every((c) => c.score === 1)
                        ? "1 pt cada"
                        : result.complementary
                            .map((c) => `${c.score}`)
                            .join(", ") + " pts"}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--cart-dim)]">
                      Traços complementares de{" "}
                      {joinPt(
                        result.complementary.map(
                          (c) => c.profile.traitKeyword,
                        ),
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
          className="cart-card mt-8 rounded-sm p-6"
          style={{
            boxShadow: `0 0 36px ${principal.accent}18, 0 18px 40px rgba(0,0,0,0.4)`,
          }}
        >
          <OrnateCorners className="p-1">
            <h3 className="cart-display text-2xl tracking-wide text-[color:var(--cart-copper-bright)]">
              Perfil Principal: {principal.title}{" "}
              <span className="text-[color:var(--cart-muted)]">
                ({principal.subtitle})
              </span>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--cart-muted)]">
              Território{" "}
              <strong className="font-medium text-[color:var(--cart-ink)]">
                {principal.grupo}
              </strong>
              . Desejo central: {principal.desejo}. {principal.modificador}
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[color:var(--cart-muted)]">
              <li>
                <span className="cart-display text-[11px] uppercase tracking-[0.18em] text-[color:var(--cart-copper)]">
                  Pontos fortes
                </span>
                <p className="mt-1 text-[color:var(--cart-ink)]/85">
                  {principal.forcas}
                </p>
              </li>
              <li>
                <span className="cart-display text-[11px] uppercase tracking-[0.18em] text-[color:var(--cart-copper)]">
                  Maior medo
                </span>
                <p className="mt-1 text-[color:var(--cart-ink)]/85">
                  {principal.medo}
                </p>
              </li>
              <li>
                <span className="cart-display text-[11px] uppercase tracking-[0.18em] text-[color:var(--cart-copper)]">
                  Perigos do Terreno
                </span>
                <p className="mt-1 text-[color:var(--cart-ink)]/85">
                  {principal.sombra}. Observe esse padrão na prática e use seus
                  sub-arquétipos para equilibrá-lo — especialmente quando a
                  pressão sobe.
                </p>
              </li>
            </ul>
          </OrnateCorners>
        </motion.div>

        {result.secondaries.length > 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.24 }}
            className="cart-card-soft mt-8 rounded-sm p-6"
          >
            <h3 className="cart-display text-2xl tracking-wide text-[color:var(--cart-ink)]">
              Como os Seus Sub-arquétipos Equilibram Você
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--cart-muted)]">
              Diferente de {principal.typicalTrap}, a sua combinação cria um
              perfil muito completo:
            </p>
            <ul className="mt-5 space-y-4">
              {result.secondaries.map((s) => (
                <li
                  key={s.profile.id}
                  className="flex items-start gap-3 sm:gap-4"
                >
                  <SecondaryThumb profile={s.profile} />
                  <div className="min-w-0 flex-1">
                    <p className="cart-display text-sm tracking-wide text-[color:var(--cart-copper-bright)]">
                      O toque de {s.profile.title}:
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[color:var(--cart-muted)]">
                      Você {s.profile.balanceBenefit}.
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        <p className="mt-8 text-center text-xs text-[color:var(--cart-dim)]">
          Escala 0–{TOTAL_QUESTIONS} pontos por arquétipo
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void downloadShareImage()}
            disabled={sharing || locked}
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
              disabled={locked}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-5 py-3.5 text-sm text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)] disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Nova Expedição
            </button>
            <button
              type="button"
              onClick={copyResult}
              disabled={locked}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-5 py-3.5 text-sm text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)] disabled:opacity-50"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado" : "Copiar Relatório Completo"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Keep share card mounted while locked so Baixar Imagem is ready the instant unlock clears */}
      <ShareCardTemplate result={result} cardRef={shareCardRef} />
    </section>
  );
}
