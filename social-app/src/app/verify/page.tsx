"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type PublicUser } from "@/lib/client";

export default function VerifyPage() {
  const { user, setUser, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      setError(
        "Câmera indisponível. Use “Simular verificação agora” — este é um localhost simulado."
      );
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL("image/jpeg", 0.85));
  }

  async function verify(selfieDataUrl?: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: PublicUser; notice: string }>("/api/verify", {
        method: "POST",
        body: JSON.stringify({ selfieDataUrl }),
      });
      setUser(data.user);
      setNotice(data.notice);
      setTimeout(() => {
        router.push(data.user.gender === "mulher" ? "/creator" : "/discover");
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na verificação");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">Carregando…</p>;
  if (!user) {
    return (
      <p className="text-muted">
        Sem sessão.{" "}
        <button className="text-accent underline" onClick={() => router.push("/")}>
          Voltar ao início
        </button>
      </p>
    );
  }
  if (user.verified) {
    router.replace(user.gender === "mulher" ? "/creator" : "/discover");
    return null;
  }

  return (
    <section className="animate-fade-up mx-auto max-w-lg">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">
        Verificação facial · anti-golpe
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
        Confirme que você é real
      </h1>
      <p className="mt-3 rounded-2xl border border-line bg-elevated/70 p-4 text-sm leading-relaxed text-muted">
        A foto (selfie) é usada <strong className="text-ink">apenas para reconhecimento
        facial / identidade</strong>, para evitar perfis falsos e golpes. Neste protótipo
        localhost a verificação é <strong className="text-accent">simulada</strong> — a
        imagem não vira mídia pública do perfil.
      </p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-soft">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selfie" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-[4/3] w-full bg-black/40 object-cover"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!streaming && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="rounded-xl border border-line bg-elevated px-4 py-2 text-sm hover:border-accent/40"
          >
            Abrir câmera
          </button>
        )}
        {streaming && !preview && (
          <button
            type="button"
            onClick={capture}
            className="rounded-xl border border-line bg-elevated px-4 py-2 text-sm"
          >
            Capturar selfie
          </button>
        )}
        {preview && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void verify(preview)}
              className="rounded-xl bg-verified px-4 py-2 text-sm font-medium text-white"
            >
              Enviar e verificar
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted"
            >
              Refazer
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void verify()}
        className="mt-6 w-full rounded-2xl bg-accent px-4 py-3 font-medium text-[#1a120a] hover:bg-[#f0a55c] disabled:opacity-60"
      >
        {busy ? "Verificando…" : "Simular verificação agora (localhost)"}
      </button>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mt-3 text-sm text-verified">{notice}</p>}
    </section>
  );
}
