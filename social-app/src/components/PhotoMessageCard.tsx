"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";
import type { PublicUser } from "@/lib/client";
import { PHOTO_CREDITS_COST, PHOTO_PRICE_BRL } from "@/lib/economy";
import { ViewOnceModal } from "./ViewOnceModal";
import { api } from "@/lib/client";

type Props = {
  message: Message;
  viewer: PublicUser;
  onUpdate: (m: Message, viewerUpdate?: PublicUser) => void;
};

export function PhotoMessageCard({ message, viewer, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [watermark, setWatermark] = useState("");

  const isSender = message.fromUserId === viewer.id;
  const expired = message.photoViewStatus === "expired_viewed";
  const locked = !isSender && !message.photoUnlocked && !expired;
  const available =
    !expired && (isSender || (message.photoUnlocked && message.photoViewStatus !== "expired_viewed"));

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ message: Message; user: PublicUser; notice?: string }>(
        `/api/photos/${message.id}/unlock`,
        { method: "POST", body: "{}" }
      );
      onUpdate(data.message, data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao desbloquear");
    } finally {
      setBusy(false);
    }
  }

  async function openView() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{
        message: { photoUrl?: string; watermark?: string };
        notice?: string;
      }>(`/api/photos/${message.id}/view`, {
        method: "POST",
        body: JSON.stringify({ action: "open" }),
      });
      if (!data.message.photoUrl) {
        setError("URL indisponível");
        return;
      }
      setModalUrl(data.message.photoUrl);
      setWatermark(data.message.watermark || `${viewer.name}`);
      setModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir");
    } finally {
      setBusy(false);
    }
  }

  async function closeView() {
    setModalOpen(false);
    setModalUrl(null);
    if (isSender) return;
    try {
      const data = await api<{ message: Message }>(`/api/photos/${message.id}/view`, {
        method: "POST",
        body: JSON.stringify({ action: "close" }),
      });
      onUpdate(data.message);
    } catch {
      onUpdate({
        ...message,
        photoUrl: undefined,
        photoViewStatus: "expired_viewed",
        text: "Visualização única encerrada — foto expirada",
      });
    }
  }

  return (
    <div className="w-[220px] overflow-hidden rounded-2xl border border-line bg-soft/80">
      <div className="relative flex aspect-[4/5] items-center justify-center bg-[#0c0a08]">
        {expired ? (
          <div className="p-4 text-center text-sm text-muted">
            <p className="font-medium text-ink/80">Visualização única encerrada</p>
            <p className="mt-1 text-xs">— foto expirada</p>
          </div>
        ) : locked ? (
          <div className="p-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-elevated text-2xl">
              🔒
            </div>
            <p className="text-xs text-muted">Foto #{message.photoIndex} · view once</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void openView()}
            disabled={busy}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-sm hover:bg-white/5"
          >
            <span className="text-3xl">📷</span>
            <span className="text-accent">
              {isSender ? "Prévia (remetente)" : "Abrir visualização única"}
            </span>
            <span className="text-[10px] text-muted">
              {message.photoFree ? "Grátis" : "Desbloqueada"} · #{message.photoIndex}
            </span>
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        {locked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void unlock()}
            className="w-full rounded-xl bg-accent px-2 py-2 text-xs font-medium text-[#1a120a] disabled:opacity-60"
          >
            Desbloquear foto — {PHOTO_CREDITS_COST} créditos (R${" "}
            {PHOTO_PRICE_BRL.toFixed(2).replace(".", ",")})
          </button>
        )}
        {expired && (
          <p className="text-center text-[11px] text-muted">
            Visualização única encerrada — foto expirada
          </p>
        )}
        {available && !isSender && (
          <p className="text-[10px] leading-snug text-muted">
            Ao fechar, a foto expira. Apps nativos devem bloquear print e usar URL assinada
            temporária.
          </p>
        )}
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>

      {modalOpen && modalUrl && (
        <ViewOnceModal
          photoUrl={modalUrl}
          watermark={watermark}
          onClose={() => void closeView()}
        />
      )}
    </div>
  );
}
