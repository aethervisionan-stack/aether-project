"use client";

import { useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import type { AssessmentMode } from "@/src/types/quiz";
import {
  buildChallengeShareText,
  buildWhatsAppShareUrl,
  copyTextToClipboard,
  formatTopPercentLabel,
  shareOrCopyInvite,
  type ShareInvitePayload,
} from "@/src/lib/challengeInvite";

type Props = {
  name: string;
  iq: number;
  marginOfError: number;
  percentile: number;
  rank: number | null;
  mode: AssessmentMode;
};

export function ChallengeSharePanel({
  name,
  iq,
  marginOfError,
  percentile,
  rank,
  mode,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const payload: ShareInvitePayload = useMemo(
    () => ({
      name,
      iq,
      marginOfError,
      percentile,
      rank,
      mode,
    }),
    [name, iq, marginOfError, percentile, rank, mode],
  );

  const shareText = useMemo(
    () => buildChallengeShareText(payload),
    [payload],
  );
  const waUrl = useMemo(() => buildWhatsAppShareUrl(shareText), [shareText]);
  const topLabel = formatTopPercentLabel(percentile);

  async function onShare() {
    setShareHint(null);
    const result = await shareOrCopyInvite(payload);
    if (result === "copied") {
      setCopied(true);
      setShareHint("Convite copiado!");
      window.setTimeout(() => {
        setCopied(false);
        setShareHint(null);
      }, 2200);
    } else if (result === "shared") {
      setShareHint(null);
    } else if (result === "failed") {
      setShareHint("Não foi possível compartilhar. Tente copiar o convite.");
    }
  }

  async function onCopyInvite() {
    const ok = await copyTextToClipboard(shareText);
    if (ok) {
      setCopied(true);
      setShareHint("Convite copiado!");
      window.setTimeout(() => {
        setCopied(false);
        setShareHint(null);
      }, 2200);
    } else {
      setShareHint("Falha ao copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <section
      aria-labelledby="iq-challenge-heading"
      className="space-y-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-zinc-950/80 to-indigo-500/8 p-5 sm:p-6"
    >
      <div className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
          Desafio social
        </p>
        <h2
          id="iq-challenge-heading"
          className="text-lg font-semibold text-zinc-50 sm:text-xl"
        >
          Desafie alguém a superar seu QI
        </h2>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-400 sm:mx-0">
          Envie seu resultado ({iq} ±{marginOfError}, {topLabel}
          {rank != null ? `, #${rank}` : ""}) e o link com{" "}
          <span className="text-zinc-300">challenger</span>,{" "}
          <span className="text-zinc-300">targetIq</span> e{" "}
          <span className="text-zinc-300">mode</span>.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => void onShare()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900/70 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-400"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Compartilhar
        </button>
        <button
          type="button"
          onClick={() => void onCopyInvite()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/55"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Convite copiado!" : "Copiar convite"}
        </button>
      </div>

      {shareHint && !copied ? (
        <p className="text-center text-xs text-zinc-400 sm:text-left" role="status">
          {shareHint}
        </p>
      ) : null}
      {copied ? (
        <p
          className="text-center text-xs font-medium text-emerald-400 sm:text-left"
          role="status"
        >
          Convite copiado!
        </p>
      ) : null}
    </section>
  );
}

export function ChallengeInviteBanner({
  challenger,
  targetIq,
  modeLabel,
}: {
  challenger: string;
  targetIq: number;
  modeLabel: string;
}) {
  return (
    <aside
      role="status"
      className="mx-auto flex w-full max-w-4xl items-start gap-3 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-400/[0.08] via-[#0C0E16]/80 to-cyan-400/[0.06] px-4 py-3 text-left shadow-[0_0_40px_-18px_rgba(52,211,153,0.45)] backdrop-blur-md sm:px-5"
    >
      <span
        aria-hidden
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
      />
      <p className="min-w-0 text-xs leading-relaxed text-zinc-400 sm:text-sm">
        <span className="font-medium text-emerald-300/90">Desafio ativo</span>
        {" — "}
        {challenger} desafiou você a superar QI{" "}
        <span className="font-iq-display tabular-nums text-zinc-200">
          {targetIq}
        </span>{" "}
        ({modeLabel}). Escolha o modo e comece quando quiser.
      </p>
    </aside>
  );
}
