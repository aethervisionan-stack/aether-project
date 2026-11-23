"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { FormEvent, useState } from "react";

type Props = {
  open: boolean;
  onSkip: () => void;
  onSubmit: (payload: { email: string; whatsapp: string }) => void;
};

/**
 * Lead magnet capture — gated by `LEAD_CAPTURE_ENABLED` in `src/data/archetypes.ts`.
 * Wire `onSubmit` to your CRM / webhook when enabling.
 */
export function LeadCaptureModal({ open, onSkip, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ email: email.trim(), whatsapp: whatsapp.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md border border-white/10 bg-[#0c0c12] p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
      >
        <button
          type="button"
          onClick={onSkip}
          className="absolute right-4 top-4 text-white/40 transition hover:text-white"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#C9A227]">
          Resultado completo
        </p>
        <h2
          id="lead-title"
          className="mt-3 font-[family-name:var(--font-arq-display)] text-2xl text-white"
        >
          Receba seu mapa arquetípico
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Deixe e-mail ou WhatsApp para receber o PDF com aplicação prática do
          seu arquétipo em vida e negócios.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="sr-only">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C9A227]/50"
            />
          </label>
          <label className="block">
            <span className="sr-only">WhatsApp</span>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="WhatsApp (opcional)"
              className="w-full border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C9A227]/50"
            />
          </label>
          <button
            type="submit"
            disabled={!email.trim() && !whatsapp.trim()}
            className="w-full bg-gradient-to-r from-[#C9A227] to-[#E8C547] px-4 py-3 text-sm font-medium text-[#0a0a0c] transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            Ver meu resultado
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-2 text-sm text-white/45 transition hover:text-white/70"
          >
            Continuar sem enviar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
