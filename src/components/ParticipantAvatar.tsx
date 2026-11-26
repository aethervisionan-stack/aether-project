"use client";

import { useId, useRef, useState } from "react";
import {
  participantInitials,
  processAvatarFile,
} from "@/src/lib/avatarImage";

const SIZE_CLASS = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-11 w-11 text-xs",
  lg: "h-14 w-14 text-sm",
} as const;

export function ParticipantAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
  ring = false,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  ring?: boolean;
}) {
  const initials = participantInitials(name);
  const ringClass = ring ? "ring-2 ring-emerald-500/45 ring-offset-1 ring-offset-zinc-950" : "";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ${SIZE_CLASS[size]} ${ringClass} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-800 font-medium text-zinc-200 ${SIZE_CLASS[size]} ${ringClass} ${className}`}
    >
      {initials}
    </span>
  );
}

export function AvatarPicker({
  name,
  avatarUrl,
  onChange,
  error,
  onError,
}: {
  name: string;
  avatarUrl: string | null;
  onChange: (next: string | null) => void;
  error?: string | null;
  onError?: (msg: string | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pickFile = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    onError?.(null);
    setBusy(true);
    try {
      const result = await processAvatarFile(file);
      if (!result.ok) {
        onError?.(result.error);
        return;
      }
      onChange(result.dataUrl);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <ParticipantAvatar
          name={name || "?"}
          avatarUrl={avatarUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium text-zinc-200">
            Foto de perfil{" "}
            <span className="font-normal text-zinc-500">(opcional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pickFile}
              disabled={busy}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50 disabled:opacity-50"
            >
              {busy
                ? "Processando…"
                : avatarUrl
                  ? "Substituir foto"
                  : "Escolher foto"}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  onError?.(null);
                }}
                disabled={busy}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
              >
                Remover
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      <p className="text-xs leading-relaxed text-zinc-500">
        A foto é opcional e serve só para identificar você no ranking e no
        resultado neste navegador. Pode pular ou limpar os dados locais a
        qualquer momento.
      </p>

      {error ? (
        <p className="text-xs text-amber-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
