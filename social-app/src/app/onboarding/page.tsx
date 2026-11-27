"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type PublicUser } from "@/lib/client";
import { avatarDataUrl } from "@/lib/avatar";
import type { Gender } from "@/lib/types";

function OnboardingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const gender = (params.get("gender") as Gender) || "homem";

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const quickAvatar = useMemo(() => {
    const initials = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
    return avatarDataUrl(
      initials || "?",
      gender === "homem" ? "#2A3A3F" : "#6B3A3A"
    );
  }, [name, gender]);

  async function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const ageNum = Number(age);
    if (ageNum < 18) {
      setError(
        "Cadastro bloqueado: é necessário ter 18 anos ou mais para usar o Chama."
      );
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ user: PublicUser }>("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          age: ageNum,
          gender,
          photoUrl: photoUrl || quickAvatar,
        }),
      });
      setUser(data.user);
      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no cadastro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="animate-fade-up mx-auto max-w-lg">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Cadastro</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
        {gender === "homem" ? "Perfil masculino" : "Perfil criadora"}
      </h1>
      <p className="mt-2 text-muted">Nome, idade e foto. Menores de 18 anos são bloqueados.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-line bg-elevated px-3 py-2.5 outline-none focus:border-accent"
            placeholder="Como quer aparecer"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Idade</span>
          <input
            required
            type="number"
            min={1}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full rounded-xl border border-line bg-elevated px-3 py-2.5 outline-none focus:border-accent"
            placeholder="18+"
          />
        </label>

        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl || quickAvatar}
            alt="Prévia"
            className="h-20 w-20 rounded-2xl border border-line object-cover"
          />
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer rounded-xl border border-line bg-soft px-3 py-2 text-sm hover:border-accent/40">
              Enviar foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              className="rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-ink"
              onClick={() => setPhotoUrl(quickAvatar)}
            >
              Usar avatar rápido
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-[#1a120a] hover:bg-[#f0a55c] disabled:opacity-60"
        >
          {busy ? "Salvando…" : "Continuar para verificação"}
        </button>
      </form>
    </section>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="text-muted">Carregando…</p>}>
      <OnboardingForm />
    </Suspense>
  );
}
