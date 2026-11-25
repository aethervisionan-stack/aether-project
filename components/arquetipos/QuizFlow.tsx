"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Question } from "@/src/data/archetypes";
import { QUESTIONS, TOTAL_QUESTIONS } from "@/src/data/scoring";
import {
  CUSTOM_ANSWER_MAX_CHARS,
  CUSTOM_ANSWER_SOFT_MIN,
  CUSTOM_OPTION_ID,
  isCustomOptionId,
  validateCustomAnswerText,
} from "@/lib/custom-answer-analyzer";
import { playParchmentClick } from "@/src/utils/soundEffects";
import { OrnateCorners, SanctuaryBackdrop } from "./CinematicChrome";

type Props = {
  index: number;
  answers: Record<string, string>;
  customAnswers: Record<string, string>;
  onSelect: (questionId: string, optionId: string) => void;
  onCustomSelect: (questionId: string, text: string) => void;
  onBack: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const CUSTOM_LABEL =
  "Nenhuma dessas descreve bem como eu agiria — responder com as minhas próprias palavras";

export function QuizFlow({
  index,
  answers,
  customAnswers,
  onSelect,
  onCustomSelect,
  onBack,
}: Props) {
  const reduce = useReducedMotion();
  const question: Question = QUESTIONS[index];
  const progress = ((index + 1) / TOTAL_QUESTIONS) * 100;
  const selected = answers[question.id];
  const isCustomSelected = isCustomOptionId(selected);

  const [draft, setDraft] = useState(customAnswers[question.id] ?? "");
  const [showCustom, setShowCustom] = useState(isCustomSelected);
  const [warn, setWarn] = useState<"empty" | "short" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(customAnswers[question.id] ?? "");
    setShowCustom(isCustomOptionId(answers[question.id]));
    setWarn(null);
  }, [question.id, answers, customAnswers]);

  useEffect(() => {
    if (!showCustom) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [showCustom, question.id]);

  function openCustom() {
    playParchmentClick();
    setShowCustom(true);
    setWarn(null);
  }

  function pickClosed(optionId: string) {
    playParchmentClick();
    setShowCustom(false);
    setWarn(null);
    onSelect(question.id, optionId);
  }

  function confirmCustom() {
    const check = validateCustomAnswerText(draft);
    if (check.empty) {
      setWarn("empty");
      textareaRef.current?.focus();
      return;
    }
    if (check.tooShort || !check.ok) {
      setWarn("short");
      textareaRef.current?.focus();
      return;
    }
    playParchmentClick();
    setWarn(null);
    onCustomSelect(question.id, check.trimmed);
  }

  const charCount = draft.trim().length;

  return (
    <section className="cine-sanctuary-band relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-8 pt-6">
      <SanctuaryBackdrop opacity={0.25} />
      <div className="relative z-10 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center border border-[color:var(--cart-border-soft)] text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)]"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="cart-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
              Trilha de Exploração · Eixo {question.stage}/4
            </p>
            <span className="tabular text-xs text-[color:var(--cart-dim)]">
              Marco {index + 1} de {TOTAL_QUESTIONS}
            </span>
          </div>
          <p className="mb-2 text-xs text-[color:var(--cart-muted)]">
            {question.stageTitle}
          </p>
          <div className="cart-trail">
            <motion.div
              className="cart-trail-fill origin-left"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: EASE }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={reduce ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -20 }}
            transition={{ duration: 0.38, ease: EASE }}
          >
            <OrnateCorners className="cart-card flex flex-col rounded-sm p-5 sm:p-6">
              <h2 className="cart-display text-[1.35rem] leading-snug tracking-wide text-[color:var(--cart-ink)] sm:text-[1.55rem]">
                {question.text}
              </h2>

              <ul className="mt-8 flex flex-col gap-3">
                {question.options.map((option, i) => {
                  const isSelected = selected === option.id;
                  return (
                    <li key={option.id}>
                      <motion.button
                        type="button"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.35,
                          ease: EASE,
                          delay: reduce ? 0 : 0.05 + i * 0.04,
                        }}
                        onClick={() => pickClosed(option.id)}
                        className={`cart-option w-full rounded-sm px-4 py-4 text-left text-[0.95rem] leading-snug ${
                          isSelected ? "cart-option-active" : ""
                        }`}
                      >
                        <span className="cart-display mr-3 inline-block text-sm text-[color:var(--cart-copper)]">
                          {option.letter}
                        </span>
                        {option.text}
                      </motion.button>
                    </li>
                  );
                })}

                <li>
                  <motion.button
                    type="button"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: EASE,
                      delay: reduce ? 0 : 0.22,
                    }}
                    onClick={openCustom}
                    className={`cart-option w-full rounded-sm px-4 py-4 text-left text-[0.95rem] leading-snug ${
                      showCustom || isCustomSelected ? "cart-option-active" : ""
                    }`}
                    aria-expanded={showCustom}
                  >
                    <span className="cart-display mr-3 inline-block text-sm text-[color:var(--cart-copper)]">
                      E
                    </span>
                    {CUSTOM_LABEL}
                  </motion.button>
                </li>
              </ul>

              <AnimatePresence>
                {showCustom && (
                  <motion.div
                    key="custom-panel"
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduce ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="mt-4 overflow-hidden"
                  >
                    <label
                      htmlFor={`custom-${question.id}`}
                      className="cart-display mb-2 block text-[11px] uppercase tracking-[0.18em] text-[color:var(--cart-copper)]"
                    >
                      Suas palavras
                    </label>
                    <textarea
                      id={`custom-${question.id}`}
                      ref={textareaRef}
                      value={draft}
                      maxLength={CUSTOM_ANSWER_MAX_CHARS}
                      rows={4}
                      placeholder="O que você pensa nesta situação e como agiria de verdade — com as suas próprias palavras."
                      onChange={(e) => {
                        setDraft(e.target.value.slice(0, CUSTOM_ANSWER_MAX_CHARS));
                        if (warn) setWarn(null);
                      }}
                      className="w-full resize-y rounded-sm border border-[color:var(--cart-border-soft)] bg-[color:var(--cart-bg-deep,rgba(8,10,14,0.55))] px-3 py-3 text-[0.95rem] leading-relaxed text-[color:var(--cart-ink)] outline-none transition placeholder:text-[color:var(--cart-dim)] focus:border-[color:var(--cart-copper)]"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-xs ${
                          charCount < CUSTOM_ANSWER_SOFT_MIN
                            ? "text-[color:var(--cart-dim)]"
                            : "text-[color:var(--cart-muted)]"
                        }`}
                      >
                        {charCount}/{CUSTOM_ANSWER_MAX_CHARS}
                        {charCount > 0 && charCount < CUSTOM_ANSWER_SOFT_MIN
                          ? ` · recomendo pelo menos ${CUSTOM_ANSWER_SOFT_MIN} caracteres`
                          : ""}
                      </p>
                      <button
                        type="button"
                        onClick={confirmCustom}
                        className="cart-display rounded-sm border border-[color:var(--cart-copper)] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--cart-copper-bright)] transition hover:bg-[color:var(--cart-copper)]/15"
                      >
                        {isCustomSelected ? "Salvar e continuar" : "Continuar"}
                      </button>
                    </div>
                    {warn === "empty" && (
                      <p className="mt-2 text-xs text-[color:var(--cart-copper-bright)]">
                        Escreva um pouco sobre como você agiria — a caixa não pode
                        ficar vazia.
                      </p>
                    )}
                    {warn === "short" && (
                      <p className="mt-2 text-xs text-[color:var(--cart-copper-bright)]">
                        Quase lá — diga um pouco mais (cerca de{" "}
                        {CUSTOM_ANSWER_SOFT_MIN} caracteres) para o espelho
                        captar o seu impulso.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </OrnateCorners>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
