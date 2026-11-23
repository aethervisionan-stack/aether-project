"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  TOTAL_QUESTIONS,
  buildIntro,
  formatShareText,
  joinPt,
  type NarrativeResult,
} from "@/src/data/archetypes";

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
    <section className="grim-atmosphere relative mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-16 pt-12">
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="grim-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--grim-gold)]"
      >
        Revelação do grimório
      </motion.p>

      {/* Ornate revealed brasão */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
        className="grim-brasao mx-auto mt-8 flex max-w-sm flex-col items-center px-6 pb-12 pt-10 text-center"
      >
        <Sparkles
          size={22}
          style={{ color: principal.accent }}
          aria-hidden
        />
        <p className="grim-display mt-4 text-[10px] uppercase tracking-[0.32em] text-[color:var(--grim-stone)]">
          {result.hybrid ? "Brasão Híbrido" : "Brasão Dominante"}
        </p>
        {result.hybrid ? (
          <h2 className="grim-display grim-title-gold mt-3 text-2xl tracking-wide sm:text-3xl">
            {result.dominants.map((d) => d.profile.title).join(" + ")}
          </h2>
        ) : (
          <h2
            className="grim-display mt-3 text-3xl tracking-wide sm:text-4xl"
            style={{ color: principal.accent }}
          >
            {principal.title}
          </h2>
        )}
        <p className="mt-2 text-sm text-[color:var(--grim-stone)]">
          {result.hybrid
            ? result.dominants.map((d) => d.profile.subtitle).join(" · ")
            : principal.subtitle}
        </p>
        <div
          className="mt-5 h-px w-16"
          style={{
            background: `linear-gradient(90deg, transparent, ${principal.accent}, transparent)`,
          }}
        />
      </motion.div>

      {/* Section 1 — Intro */}
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.12 }}
        className="mt-10 text-base leading-relaxed text-[color:var(--grim-stone)]"
      >
        {intro}
      </motion.p>

      {/* Section 2 — Score table */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.16 }}
        className="grim-card mt-10 overflow-hidden rounded-sm"
      >
        <div className="border-b border-[color:var(--grim-border-soft)] px-4 py-3">
          <h3 className="grim-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--grim-gold)]">
            Resultado Completo da Sua Pontuação
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--grim-border-soft)] text-[11px] uppercase tracking-[0.14em] text-[color:var(--grim-stone-dim)]">
                <th className="px-4 py-3 font-medium">Arquétipo</th>
                <th className="px-4 py-3 font-medium">Pontos</th>
                <th className="px-4 py-3 font-medium">Papel no Seu Perfil</th>
              </tr>
            </thead>
            <tbody>
              {result.dominants.map((d) => (
                <tr
                  key={d.profile.id}
                  className="border-b border-[color:var(--grim-border-soft)] align-top"
                >
                  <td className="px-4 py-3 font-semibold text-[color:var(--grim-ink)]">
                    {d.profile.title}
                  </td>
                  <td className="px-4 py-3 tabular text-[color:var(--grim-gold)]">
                    {d.score} pts
                  </td>
                  <td className="px-4 py-3 text-[color:var(--grim-stone)]">
                    {d.profile.dominantRole}
                  </td>
                </tr>
              ))}
              {result.secondaries.map((s) => (
                <tr
                  key={s.profile.id}
                  className="border-b border-[color:var(--grim-border-soft)] align-top"
                >
                  <td className="px-4 py-3 font-semibold text-[color:var(--grim-ink)]">
                    {s.profile.title}
                  </td>
                  <td className="px-4 py-3 tabular text-[color:var(--grim-stone)]">
                    {s.score} pts
                  </td>
                  <td className="px-4 py-3 text-[color:var(--grim-stone)]">
                    {s.profile.subRole}
                  </td>
                </tr>
              ))}
              {result.complementary.length > 0 && (
                <tr className="align-top">
                  <td className="px-4 py-3 text-[color:var(--grim-ink)]/85">
                    {result.complementary
                      .map((c) => c.profile.title)
                      .join(" / ")}
                  </td>
                  <td className="px-4 py-3 tabular text-[color:var(--grim-stone-dim)]">
                    {result.complementary.every((c) => c.score === 1)
                      ? "1 pt cada"
                      : result.complementary
                          .map((c) => `${c.score}`)
                          .join(", ") + " pts"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--grim-stone-dim)]">
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

      {/* Section 3 — Principal profile */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
        className="grim-card mt-8 rounded-sm p-6"
        style={{
          boxShadow: `0 0 40px ${principal.accent}22, 0 18px 40px rgba(0,0,0,0.35)`,
        }}
      >
        <h3 className="grim-display text-2xl tracking-wide text-[color:var(--grim-gold-bright)]">
          Perfil Principal: {principal.title}{" "}
          <span className="text-[color:var(--grim-stone)]">
            ({principal.subtitle})
          </span>
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--grim-stone)]">
          Grupo{" "}
          <strong className="font-medium text-[color:var(--grim-ink)]">
            {principal.grupo}
          </strong>
          . Desejo central: {principal.desejo}. {principal.modificador}
        </p>
        <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[color:var(--grim-stone)]">
          <li>
            <span className="grim-display text-[11px] uppercase tracking-[0.18em] text-[color:var(--grim-gold)]">
              Pontos fortes
            </span>
            <p className="mt-1 text-[color:var(--grim-ink)]/80">
              {principal.forcas}
            </p>
          </li>
          <li>
            <span className="grim-display text-[11px] uppercase tracking-[0.18em] text-[color:var(--grim-gold)]">
              Maior medo
            </span>
            <p className="mt-1 text-[color:var(--grim-ink)]/80">
              {principal.medo}
            </p>
          </li>
          <li>
            <span className="grim-display text-[11px] uppercase tracking-[0.18em] text-[color:var(--grim-gold)]">
              Ponto de atenção (Sombra)
            </span>
            <p className="mt-1 text-[color:var(--grim-ink)]/80">
              {principal.sombra}. Observe esse padrão na prática e use seus
              sub-arquétipos para equilibrá-lo — especialmente quando a pressão
              sobe.
            </p>
          </li>
        </ul>
      </motion.div>

      {/* Section 4 — Sub balance */}
      {result.secondaries.length > 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.24 }}
          className="grim-card-soft mt-8 rounded-sm p-6"
        >
          <h3 className="grim-display text-2xl tracking-wide text-[color:var(--grim-ink)]">
            Como os Seus Sub-arquétipos Equilibram Você
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--grim-stone)]">
            Diferente de {principal.typicalTrap}, a sua combinação cria um
            perfil muito completo:
          </p>
          <ul className="mt-5 space-y-4">
            {result.secondaries.map((s) => (
              <li key={s.profile.id}>
                <p className="grim-display text-sm tracking-wide text-[color:var(--grim-gold-bright)]">
                  O toque de {s.profile.title}:
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--grim-stone)]">
                  Você {s.profile.balanceBenefit}.
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <p className="mt-8 text-center text-xs text-[color:var(--grim-stone-dim)]">
        Escala 0–{TOTAL_QUESTIONS} pontos por arquétipo
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--grim-border-soft)] px-5 py-3.5 text-sm text-[color:var(--grim-stone)] transition hover:border-[color:var(--grim-gold)] hover:text-[color:var(--grim-gold-bright)]"
        >
          <RotateCcw size={16} />
          Refazer Teste
        </button>
        <button
          type="button"
          onClick={copyResult}
          className="grim-cta inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-5 py-3.5 text-sm font-semibold"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copiado" : "Copiar Resultado Completo"}
        </button>
      </div>
    </section>
  );
}
