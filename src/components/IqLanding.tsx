"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ANONYMOUS_PARTICIPANT_NAME,
  LEADERBOARD_MODE_LABEL,
  MODE_META,
  type AssessmentMode,
} from "@/src/types/quiz";
import { ChallengeInviteBanner } from "@/src/components/ChallengeSharePanel";
import { LeaderboardPanel } from "@/src/components/LeaderboardPanel";
import { OnlinePresenceBadge } from "@/src/components/OnlinePresenceBadge";
import { AvatarPicker } from "@/src/components/ParticipantAvatar";
import { SkillHelpTip } from "@/src/components/SkillHelpTip";
import { LivingBrainLogo } from "@/src/components/LivingBrainLogo";
import { TestLineQiFooter } from "@/src/components/TestLineQiLogo";
import type { ChallengeInvite } from "@/src/lib/challengeInvite";
import { ESCALA_HELP } from "@/src/lib/skillHelp";

/** Promessas do hero alinhadas ao painel de resultados. */
const HERO_PROMISE_PILLS = [
  {
    t: "Seu perfil",
    d: "Equilibrado ou com pontos fortes diferentes — o resumo da sua sessão",
  },
  {
    t: "Fortes e fracos",
    d: "O que te ajuda a ir bem e o que ainda puxa o resultado para baixo",
  },
  {
    t: "Onde você brilha",
    d: "O tipo de tarefa em que você tende a se sair melhor",
  },
] as const;

const TRANSPARENCY = [
  {
    t: "Em que nos baseamos",
    d: "O teste olha seis áreas: palavras, lógica, visão espacial, memória de curto prazo, velocidade e tempo de reação. Cada uma tem suas perguntas. O QI geral vem do seu desempenho no conjunto — não de decorar matéria da escola.",
    span: "md:col-span-2 md:row-span-1",
  },
  {
    t: "Como as perguntas são feitas",
    d: "As questões vão do mais fácil ao mais difícil, em figura ou texto. Cada uma tem uma resposta certa, com explicação. Também olhamos tempo e hesitação para ver se o resultado ficou estável.",
    span: "md:col-span-1",
  },
  {
    t: "O que este resultado não é",
    d: "É uma estimativa online do seu perfil e do seu QI. Não substitui avaliação com psicólogo presencial nem laudo oficial.",
    span: "md:col-span-3",
  },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

export function IqLanding({
  participantName,
  participantAvatarUrl,
  nameError,
  avatarError,
  challengeInvite,
  leaderboardTick,
  onNameChange,
  onAvatarChange,
  onAvatarError,
  onSelectMode,
}: {
  participantName: string;
  participantAvatarUrl: string | null;
  nameError: string | null;
  avatarError: string | null;
  challengeInvite: ChallengeInvite | null;
  leaderboardTick: number;
  onNameChange: (value: string) => void;
  onAvatarChange: (next: string | null) => void;
  onAvatarError: (msg: string | null) => void;
  onSelectMode: (mode: AssessmentMode) => void;
}) {
  const reduce = useReducedMotion();
  const [pendingMode, setPendingMode] = useState<AssessmentMode | null>(null);
  const [modeHint, setModeHint] = useState<string | null>(null);

  const fadeUp = (delay = 0) =>
    reduce
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease },
        };

  const continueWithMode = (mode: AssessmentMode) => {
    setModeHint(null);
    onSelectMode(mode);
  };

  const onCta = () => {
    if (!pendingMode) {
      setModeHint("Escolha um tipo de teste para continuar.");
      document.getElementById("iq-mode-cards")?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "nearest",
      });
      return;
    }
    continueWithMode(pendingMode);
  };

  return (
    <motion.section
      key="modeSelect"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reduce ? 0 : 0.35 }}
      className="space-y-14 sm:space-y-20"
    >
      <nav
        aria-label="Navegação do teste"
        className="sticky top-3 z-30 mx-auto flex max-w-full items-center justify-between gap-3 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0B0D14]/70 px-3 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl sm:px-4"
      >
        <LivingBrainLogo href="#iniciar" size="sm" />
        <div className="flex items-center gap-1 sm:gap-2">
          {(
            [
              ["#iniciar", "Iniciar"],
              ["#metodologia", "Como funciona"],
              ["#ranking", "Ranking"],
            ] as const
          ).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100 sm:px-3 sm:text-sm"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {challengeInvite ? (
        <motion.div {...fadeUp(0.05)} className="px-0">
          <ChallengeInviteBanner
            challenger={challengeInvite.challenger}
            targetIq={challengeInvite.targetIq}
            modeLabel={LEADERBOARD_MODE_LABEL[challengeInvite.mode]}
          />
        </motion.div>
      ) : null}

      <div
        id="iniciar"
        className="grid scroll-mt-24 items-start gap-8 lg:grid-cols-12 lg:gap-10"
      >
        <motion.div
          {...fadeUp(0.08)}
          className="space-y-6 lg:col-span-6 xl:col-span-7"
        >
          <div className="space-y-3">
            <LivingBrainLogo
              href={null}
              size="lg"
              showWordmark
              className="drop-shadow-[0_0_28px_rgba(34,211,238,0.28)]"
            />
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-300/80">
              Teste online · Perfil e QI
            </p>
          </div>
          <OnlinePresenceBadge className="pt-1" />
          <h1 className="font-iq-display max-w-[16ch] text-4xl leading-[1.05] tracking-tight text-zinc-50 sm:text-5xl lg:text-[3.35rem]">
            Descubra como você pensa
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            Veja seus pontos fortes, o que ainda trava e onde você tende a
            brilhar — lógica, memória, visão espacial ou decisões rápidas. Quiz
            com ranking neste aparelho: resultado claro, sem milagre.
          </p>
          <ul className="grid max-w-xl grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            {HERO_PROMISE_PILLS.map((pill) => (
              <li
                key={pill.t}
                className="rounded-xl border border-white/[0.07] bg-[#0C0E16]/60 px-3 py-3 backdrop-blur-sm"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-300/75">
                  {pill.t}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-zinc-400">
                  {pill.d}
                </p>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          {...fadeUp(0.14)}
          className="lg:col-span-6 xl:col-span-5"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0C0E16]/75 p-5 shadow-[0_0_60px_-20px_rgba(99,102,241,0.35)] backdrop-blur-xl sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 left-0 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl"
            />

            <div className="relative space-y-5">
              <div>
                <h2 className="font-iq-display text-lg tracking-tight text-zinc-50">
                  Começar o teste
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Nome opcional e escolha do tipo. Cada tipo guarda o progresso
                  separado.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="iq-landing-participant-name"
                  className="block text-sm font-medium text-zinc-200"
                >
                  Nome ou apelido
                </label>
                <input
                  id="iq-landing-participant-name"
                  type="text"
                  autoComplete="nickname"
                  maxLength={40}
                  value={participantName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={`Ex.: Maria Silva (vazio → ${ANONYMOUS_PARTICIPANT_NAME})`}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#06070A]/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25"
                />
                <p className="text-xs leading-relaxed text-zinc-500">
                  Use um nome real se quiser aparecer com clareza no ranking
                  deste aparelho. Se deixar em branco, fica como{" "}
                  {ANONYMOUS_PARTICIPANT_NAME}.
                </p>
                {nameError ? (
                  <p className="text-xs text-amber-400" role="alert">
                    {nameError}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <AvatarPicker
                  name={
                    participantName.trim() || ANONYMOUS_PARTICIPANT_NAME
                  }
                  avatarUrl={participantAvatarUrl}
                  error={avatarError}
                  onError={onAvatarError}
                  onChange={onAvatarChange}
                />
              </div>

              <div id="iq-mode-cards" className="space-y-2.5 scroll-mt-28">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Tipo de teste
                </p>
                <div className="grid gap-2">
                  {(Object.keys(MODE_META) as AssessmentMode[]).map((m) => {
                    const meta = MODE_META[m];
                    const active = pendingMode === m;
                    return (
                      <motion.button
                        key={m}
                        type="button"
                        whileHover={reduce ? undefined : { y: -1 }}
                        whileTap={reduce ? undefined : { scale: 0.985 }}
                        onClick={() => {
                          setPendingMode(m);
                          setModeHint(null);
                          continueWithMode(m);
                        }}
                        className={`rounded-2xl border p-3.5 text-left transition ${
                          active
                            ? "border-cyan-400/40 bg-cyan-400/[0.07] shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]"
                            : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                          Opção
                        </p>
                        <h3 className="mt-0.5 font-iq-display text-base tracking-tight text-zinc-50">
                          {meta.label}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {meta.blurb}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
                {modeHint ? (
                  <p className="text-xs text-amber-400" role="alert">
                    {modeHint}
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-600">
                    Clique em um tipo para ver o tutorial e as regras.
                  </p>
                )}
              </div>

              <motion.button
                type="button"
                whileHover={
                  reduce
                    ? undefined
                    : {
                        boxShadow:
                          "0 0 36px -6px rgba(52,211,153,0.55), 0 0 0 1px rgba(52,211,153,0.25)",
                      }
                }
                whileTap={reduce ? undefined : { scale: 0.98 }}
                onClick={onCta}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 px-6 py-3.5 text-sm font-semibold text-[#06070A] shadow-[0_0_28px_-6px_rgba(52,211,153,0.55)] transition"
              >
                Ir para a preparação
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.section
        id="metodologia"
        aria-labelledby="iq-transparency-heading"
        {...fadeUp(0.18)}
        className="scroll-mt-24 space-y-5"
      >
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-indigo-300/80">
            Como funciona
          </p>
          <h2
            id="iq-transparency-heading"
            className="font-iq-display text-2xl tracking-tight text-zinc-50 sm:text-3xl"
          >
            Tudo com transparência
          </h2>
          <p className="max-w-2xl text-sm text-zinc-500 sm:text-base">
            Em que o teste se baseia, como as perguntas são feitas e o que o
            resultado significa — em linguagem clara.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            Pontuação: média 100
            <SkillHelpTip label="Pontuação: média 100" help={ESCALA_HELP} />
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {TRANSPARENCY.map((c, i) => (
            <motion.article
              key={c.t}
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 12 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, margin: "-40px" },
                    transition: { delay: i * 0.06, duration: 0.4, ease },
                  })}
              className={`${c.span} rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-5 backdrop-blur-md`}
            >
              <h3 className="font-iq-display text-base tracking-tight text-zinc-100">
                {c.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {c.d}
              </p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.div id="ranking" className="scroll-mt-24" {...fadeUp(0.22)}>
        <LeaderboardPanel refreshKey={leaderboardTick} hallOfFame />
      </motion.div>

      <TestLineQiFooter />
    </motion.section>
  );
}

export function PsychometricTransparencyBlock({
  compact = false,
}: {
  compact?: boolean;
}) {
  const cards = TRANSPARENCY.map(({ t, d }) => ({ t, d }));

  return (
    <section
      aria-labelledby="iq-transparency-heading-compact"
      className={`rounded-2xl border border-white/[0.08] bg-[#0C0E16]/70 backdrop-blur-md ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
    >
      <div className="mb-4 space-y-1">
        <h2
          id="iq-transparency-heading-compact"
          className="font-iq-display text-sm tracking-tight text-zinc-100 sm:text-base"
        >
          Tudo com transparência
        </h2>
        <p
          className={
            compact
              ? "text-xs text-zinc-500 sm:text-sm"
              : "text-sm text-zinc-500"
          }
        >
          Em que o teste se baseia, como as perguntas são feitas e o que o
          resultado significa — em linguagem clara.
        </p>
        <p className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-zinc-400">
          Pontuação: média 100
          <SkillHelpTip label="Pontuação: média 100" help={ESCALA_HELP} />
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.t}
            className="space-y-1.5 rounded-xl border border-white/[0.06] bg-[#06070A]/50 p-3.5"
          >
            <h3 className="text-sm font-medium text-zinc-200">{c.t}</h3>
            <p className="text-sm leading-relaxed text-zinc-500">{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
