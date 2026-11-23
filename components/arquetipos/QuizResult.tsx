"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, RotateCcw, Share2 } from "lucide-react";
import { useState } from "react";
import {
  ARCHETYPES,
  formatShareText,
  type RankedArchetype,
} from "@/src/data/archetypes";

type Props = {
  ranked: RankedArchetype[];
  onRestart: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function QuizResult({ ranked, onRestart }: Props) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const dominantRank = ranked[0];
  const secondaryRank = ranked[1];
  const dominant = ARCHETYPES[dominantRank.id];
  const secondary = ARCHETYPES[secondaryRank.id];

  async function share() {
    const text = formatShareText(
      dominant,
      secondary,
      dominantRank.percent,
      secondaryRank.percent,
    );
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/arquetipos`
        : "/arquetipos";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Meu arquétipo: ${dominant.name}`,
          text,
          url,
        });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
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

      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: EASE, delay: 0.06 }}
        className="mt-3 font-[family-name:var(--font-arq-display)] text-[clamp(2.4rem,10vw,3.75rem)] leading-[0.95] tracking-[-0.03em] text-[#F3EDE0]"
        style={{ color: dominant.accent }}
      >
        {dominant.name}
      </motion.h2>

      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="mt-4 text-sm text-white/50"
      >
        Afinidade {dominantRank.percent}% · Secundário{" "}
        <span className="text-[#F3EDE0]/85">{secondary.name}</span> (
        {secondaryRank.percent}%)
      </motion.p>

      <motion.blockquote
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
        className="mt-8 border-l-2 border-[#C9A227]/60 pl-4 font-[family-name:var(--font-arq-display)] text-xl italic leading-snug text-[#F3EDE0]/90"
      >
        “{dominant.lema}”
      </motion.blockquote>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
        className="mt-6 text-base leading-relaxed text-[#F3EDE0]/70"
      >
        {dominant.summary}
      </motion.p>

      {/* Affinity bars — interaction-relevant comparison */}
      <div className="mt-10 space-y-3">
        {ranked.slice(0, 4).map((item, i) => {
          const arch = ARCHETYPES[item.id];
          return (
            <div key={item.id}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-[#F3EDE0]/705">{arch.name}</span>
                <span className="tabular text-white/40">{item.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-white/8">
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: arch.accent }}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${item.percent}%` }}
                  transition={{
                    duration: 0.8,
                    ease: EASE,
                    delay: reduce ? 0 : 0.25 + i * 0.06,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 space-y-8 border-t border-white/10 pt-10">
        <ResultBlock title="Pontos fortes" items={dominant.strengths} />
        <ResultBlock title="Sombras" items={dominant.shadows} />
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-[#C9A227]/90">
            Vida
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[#F3EDE0]/70">
            {dominant.life}
          </p>
        </div>
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-[#C9A227]/90">
            Negócios e posicionamento
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[#F3EDE0]/70">
            {dominant.business}
          </p>
        </div>
        <div className="border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            Arquétipo secundário
          </h3>
          <p
            className="mt-2 font-[family-name:var(--font-arq-display)] text-2xl"
            style={{ color: secondary.accent }}
          >
            {secondary.name}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {secondary.summary}
          </p>
        </div>
      </div>

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
          onClick={share}
          className="inline-flex flex-1 items-center justify-center gap-2 bg-gradient-to-r from-[#C9A227] to-[#E8C547] px-5 py-3.5 text-sm font-semibold text-[#0a0a0c] transition hover:brightness-110"
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          {copied ? "Copiado" : "Compartilhar Resultado"}
          {!copied && <Copy size={14} className="opacity-50" />}
        </button>
      </div>
    </section>
  );
}

function ResultBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-[0.22em] text-[#C9A227]/90">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-sm leading-relaxed text-[#F3EDE0]/70"
          >
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#C9A227]/80" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
