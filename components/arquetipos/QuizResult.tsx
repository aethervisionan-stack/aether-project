"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, RotateCcw, ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  TOTAL_QUESTIONS,
  buildIntro,
  formatShareText,
  joinPt,
  type NarrativeResult,
} from "@/src/data/archetypes";
import { playRevealChord } from "@/src/utils/soundEffects";
import { OrnateCorners, SanctuaryBackdrop } from "./CinematicChrome";

type Props = {
  result: NarrativeResult;
  onRestart: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function QuizResult({ result, onRestart }: Props) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const intro = useMemo(() => buildIntro(result), [result]);
  const principal = result.primary;

  useEffect(() => {
    playRevealChord();
  }, []);

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(formatShareText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
        Relatório de Expedição
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
        className="mx-auto mt-8 max-w-md"
      >
        <OrnateCorners className="cart-scroll rounded-sm px-6 pb-12 pt-10 text-center">
        <ScrollText
          size={22}
          style={{ color: principal.accent }}
          aria-hidden
        />
        <p className="cart-display mt-4 text-[10px] uppercase tracking-[0.32em] text-[color:var(--cart-muted)]">
          {result.hybrid ? "Pergaminho Híbrido" : "Pergaminho Dominante"}
        </p>
        {result.hybrid ? (
          <h2 className="cart-display cart-title-torch mt-3 text-2xl tracking-wide sm:text-3xl">
            {result.dominants.map((d) => d.profile.title).join(" + ")}
          </h2>
        ) : (
          <h2
            className="cart-display mt-3 text-3xl tracking-wide sm:text-4xl"
            style={{ color: principal.accent }}
          >
            {principal.title}
          </h2>
        )}
        <p className="mt-2 text-sm text-[color:var(--cart-muted)]">
          {result.hybrid
            ? result.dominants.map((d) => d.profile.subtitle).join(" · ")
            : principal.subtitle}
        </p>
        <div
          className="mx-auto mt-5 h-px w-16"
          style={{
            background: `linear-gradient(90deg, transparent, ${principal.accent}, transparent)`,
          }}
        />
        </OrnateCorners>
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
                      result.complementary.map((c) => c.profile.traitKeyword),
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
              sub-arquétipos para equilibrá-lo — especialmente quando a pressão
              sobe.
            </p>
          </li>
        </ul>
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
              <li key={s.profile.id}>
                <p className="cart-display text-sm tracking-wide text-[color:var(--cart-copper-bright)]">
                  O toque de {s.profile.title}:
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--cart-muted)]">
                  Você {s.profile.balanceBenefit}.
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <p className="mt-8 text-center text-xs text-[color:var(--cart-dim)]">
        Escala 0–{TOTAL_QUESTIONS} pontos por arquétipo
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
          className="cart-cta inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-5 py-3.5 text-sm font-semibold"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copiado" : "Copiar Relatório Completo"}
        </button>
      </div>
      </div>
    </section>
  );
}
