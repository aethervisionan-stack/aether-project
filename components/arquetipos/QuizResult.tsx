"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, RotateCcw } from "lucide-react";
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
    <section className="relative mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-16 pt-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(201,162,39,0.12),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(79,70,229,0.14),transparent_50%)]" />

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="text-[11px] uppercase tracking-[0.28em] text-[#C9A227]"
      >
        Seu resultado
      </motion.p>

      {/* Section 1 — Intro */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
        className="mt-4"
      >
        {result.hybrid ? (
          <h2 className="font-[family-name:var(--font-arq-display)] text-[clamp(1.9rem,7vw,2.85rem)] leading-[1.05] tracking-[-0.02em] text-[#F3EDE0]">
            Perfil Híbrido
          </h2>
        ) : (
          <h2
            className="font-[family-name:var(--font-arq-display)] text-[clamp(2.1rem,8vw,3.25rem)] leading-[0.95] tracking-[-0.03em]"
            style={{ color: principal.accent }}
          >
            {principal.title}
          </h2>
        )}
        <p className="mt-5 text-base leading-relaxed text-[#F3EDE0]/75">
          {intro}
        </p>
      </motion.div>

      {/* Section 2 — Score table */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.12 }}
        className="mt-10 overflow-hidden border border-white/10"
      >
        <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-[#C9A227]/90">
            Resultado Completo da Sua Pontuação
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-white/40">
                <th className="px-4 py-3 font-medium">Arquétipo</th>
                <th className="px-4 py-3 font-medium">Pontos</th>
                <th className="px-4 py-3 font-medium">Papel no Seu Perfil</th>
              </tr>
            </thead>
            <tbody>
              {result.dominants.map((d) => (
                <tr
                  key={d.profile.id}
                  className="border-b border-white/8 align-top"
                >
                  <td className="px-4 py-3 font-semibold text-[#F3EDE0]">
                    {d.profile.title}
                  </td>
                  <td className="px-4 py-3 tabular text-[#F3EDE0]/80">
                    {d.score} pts
                  </td>
                  <td className="px-4 py-3 text-[#F3EDE0]/65">
                    {d.profile.dominantRole}
                  </td>
                </tr>
              ))}
              {result.secondaries.map((s) => (
                <tr
                  key={s.profile.id}
                  className="border-b border-white/8 align-top"
                >
                  <td className="px-4 py-3 font-semibold text-[#F3EDE0]">
                    {s.profile.title}
                  </td>
                  <td className="px-4 py-3 tabular text-[#F3EDE0]/80">
                    {s.score} pts
                  </td>
                  <td className="px-4 py-3 text-[#F3EDE0]/65">
                    {s.profile.subRole}
                  </td>
                </tr>
              ))}
              {result.complementary.length > 0 && (
                <tr className="align-top">
                  <td className="px-4 py-3 text-[#F3EDE0]/85">
                    {result.complementary
                      .map((c) => c.profile.title)
                      .join(" / ")}
                  </td>
                  <td className="px-4 py-3 tabular text-[#F3EDE0]/70">
                    {result.complementary.every((c) => c.score === 1)
                      ? "1 pt cada"
                      : result.complementary
                          .map((c) => `${c.score}`)
                          .join(", ") + " pts"}
                  </td>
                  <td className="px-4 py-3 text-[#F3EDE0]/55">
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

      {/* Section 3 — Principal profile card */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.18 }}
        className={`mt-8 border p-6 ${principal.colorClass}`}
      >
        <h3 className="font-[family-name:var(--font-arq-display)] text-2xl text-[#F3EDE0]">
          Perfil Principal: {principal.title}{" "}
          <span className="text-[#F3EDE0]/55">({principal.subtitle})</span>
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#F3EDE0]/70">
          Grupo <strong className="font-medium text-[#F3EDE0]/90">{principal.grupo}</strong>.
          Desejo central: {principal.desejo}. {principal.modificador}
        </p>
        <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[#F3EDE0]/75">
          <li>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#C9A227]/90">
              Pontos fortes
            </span>
            <p className="mt-1">{principal.forcas}</p>
          </li>
          <li>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#C9A227]/90">
              Maior medo
            </span>
            <p className="mt-1">{principal.medo}</p>
          </li>
          <li>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#C9A227]/90">
              Ponto de atenção (Sombra)
            </span>
            <p className="mt-1">
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
          className="mt-8 border border-white/10 bg-white/[0.02] p-6"
        >
          <h3 className="font-[family-name:var(--font-arq-display)] text-2xl text-[#F3EDE0]">
            Como os Seus Sub-arquétipos Equilibram Você
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[#F3EDE0]/65">
            Diferente de {principal.typicalTrap}, a sua combinação cria um
            perfil muito completo:
          </p>
          <ul className="mt-5 space-y-4">
            {result.secondaries.map((s) => (
              <li key={s.profile.id}>
                <p className="text-sm font-semibold text-[#F3EDE0]">
                  O toque de {s.profile.title}:
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#F3EDE0]/65">
                  Você {s.profile.balanceBenefit}.
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <p className="mt-8 text-center text-xs text-white/35">
        Escala 0–{TOTAL_QUESTIONS} pontos por arquétipo
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-white/15 px-5 py-3.5 text-sm text-[#F3EDE0] transition hover:border-[#C9A227]/40"
        >
          <RotateCcw size={16} />
          Refazer Teste
        </button>
        <button
          type="button"
          onClick={copyResult}
          className="inline-flex flex-1 items-center justify-center gap-2 bg-gradient-to-r from-[#C9A227] to-[#E8C547] px-5 py-3.5 text-sm font-semibold text-[#0a0a0c] transition hover:brightness-110"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copiado" : "Copiar Resultado Completo"}
        </button>
      </div>
    </section>
  );
}
