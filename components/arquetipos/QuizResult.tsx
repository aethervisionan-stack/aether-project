"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ARCHETYPES,
  TOTAL_QUESTIONS,
  buildResumo,
  formatShareText,
  type QuizOutcome,
  type RankedArchetype,
} from "@/src/data/archetypes";

type Props = {
  outcome: QuizOutcome;
  onRestart: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function QuizResult({ outcome, onRestart }: Props) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const resumo = useMemo(() => buildResumo(outcome), [outcome]);
  const chartRows = useMemo(
    () => outcome.ranked.filter((r) => r.score > 0),
    [outcome.ranked],
  );

  async function copyResult() {
    const text = formatShareText(outcome);
    try {
      await navigator.clipboard.writeText(text);
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

      {outcome.kind === "dominant" ? (
        <DominantHeader
          dominant={outcome.dominant}
          sub={outcome.sub}
          dominantScore={outcome.dominantScore}
          subScore={outcome.subScore}
          reduce={!!reduce}
        />
      ) : (
        <HybridHeader
          tied={outcome.tied}
          score={outcome.score}
          reduce={!!reduce}
        />
      )}

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.18 }}
        className="mt-6 text-base leading-relaxed text-[#F3EDE0]/70"
      >
        {resumo}
      </motion.p>

      <div className="mt-10 space-y-6 border-t border-white/10 pt-10">
        {outcome.kind === "dominant" ? (
          <ProfileBlocks
            title={outcome.dominant.title}
            desejo={outcome.dominant.desejo}
            forcas={outcome.dominant.forcas}
            medo={outcome.dominant.medo}
            sombra={outcome.dominant.sombra}
            colorClass={outcome.dominant.colorClass}
          />
        ) : (
          outcome.tied.map((p) => (
            <ProfileBlocks
              key={p.id}
              title={p.title}
              desejo={p.desejo}
              forcas={p.forcas}
              medo={p.medo}
              sombra={p.sombra}
              colorClass={p.colorClass}
            />
          ))
        )}
      </div>

      <ScoreChart rows={chartRows} reduce={!!reduce} />

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
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
          {copied ? "Copiado" : "Copiar Resultado"}
        </button>
      </div>
    </section>
  );
}

function DominantHeader({
  dominant,
  sub,
  dominantScore,
  subScore,
  reduce,
}: {
  dominant: (typeof ARCHETYPES)[keyof typeof ARCHETYPES];
  sub: (typeof ARCHETYPES)[keyof typeof ARCHETYPES];
  dominantScore: number;
  subScore: number;
  reduce: boolean;
}) {
  return (
    <>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-3 text-sm text-white/45"
      >
        Arquétipo Dominante · {dominantScore}/{TOTAL_QUESTIONS}
      </motion.p>
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: EASE, delay: 0.06 }}
        className="mt-2 font-[family-name:var(--font-arq-display)] text-[clamp(2.2rem,9vw,3.5rem)] leading-[0.95] tracking-[-0.03em]"
        style={{ color: dominant.accent }}
      >
        {dominant.title}
      </motion.h2>
      <p className="mt-2 text-sm text-[#F3EDE0]/55">{dominant.subtitle}</p>
      <div
        className={`mt-5 inline-flex border px-3 py-1.5 text-xs ${dominant.colorClass}`}
      >
        Grupo: {dominant.grupo}
      </div>
      <p className="mt-6 text-sm text-white/50">
        Sub-arquétipo:{" "}
        <span style={{ color: sub.accent }} className="font-medium">
          {sub.title}
        </span>{" "}
        ({subScore}/{TOTAL_QUESTIONS}) — {sub.subtitle}
      </p>
    </>
  );
}

function HybridHeader({
  tied,
  score,
  reduce,
}: {
  tied: [
    (typeof ARCHETYPES)[keyof typeof ARCHETYPES],
    (typeof ARCHETYPES)[keyof typeof ARCHETYPES],
  ];
  score: number;
  reduce: boolean;
}) {
  const [a, b] = tied;
  return (
    <>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-3 text-sm text-white/45"
      >
        Perfil Híbrido · {score}/{TOTAL_QUESTIONS} cada
      </motion.p>
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: EASE, delay: 0.06 }}
        className="mt-2 font-[family-name:var(--font-arq-display)] text-[clamp(1.85rem,7vw,3rem)] leading-[1.05] tracking-[-0.02em] text-[#F3EDE0]"
      >
        <span style={{ color: a.accent }}>{a.title}</span>
        <span className="text-white/35"> + </span>
        <span style={{ color: b.accent }}>{b.title}</span>
      </motion.h2>
      <p className="mt-3 text-sm text-[#F3EDE0]/55">
        {a.subtitle} · {b.subtitle}
      </p>
    </>
  );
}

function ProfileBlocks({
  title,
  desejo,
  forcas,
  medo,
  sombra,
  colorClass,
}: {
  title: string;
  desejo: string;
  forcas: string;
  medo: string;
  sombra: string;
  colorClass: string;
}) {
  return (
    <div className={`border p-5 ${colorClass}`}>
      <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">
        {title}
      </p>
      <Field label="Desejo Central" value={desejo} />
      <Field label="Pontos Fortes" value={forcas} />
      <Field label="Maior Medo" value={medo} />
      <Field label="Sombra (Ponto de Atenção)" value={sombra} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#C9A227]/90">
        {label}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#F3EDE0]/75">
        {value}
      </p>
    </div>
  );
}

function ScoreChart({
  rows,
  reduce,
}: {
  rows: RankedArchetype[];
  reduce: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-12 border-t border-white/10 pt-10">
      <h3 className="text-[11px] uppercase tracking-[0.22em] text-[#C9A227]/90">
        Pontuação (0–{TOTAL_QUESTIONS})
      </h3>
      <div className="mt-6 space-y-3">
        {rows.map((item, i) => {
          const arch = ARCHETYPES[item.id];
          const width = (item.score / TOTAL_QUESTIONS) * 100;
          return (
            <div key={item.id}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-[#F3EDE0]/75">{arch.title}</span>
                <span className="tabular text-white/40">
                  {item.score}/{TOTAL_QUESTIONS}
                </span>
              </div>
              <div className="h-2 overflow-hidden bg-white/8">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: arch.accent }}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{
                    duration: 0.75,
                    ease: EASE,
                    delay: reduce ? 0 : 0.15 + i * 0.05,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
