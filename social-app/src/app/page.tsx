"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { Gender } from "@/lib/types";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [gender, setGender] = useState<Gender | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user?.verified) {
      router.replace(user.gender === "mulher" ? "/creator" : "/discover");
    } else if (user && !user.verified) {
      router.replace("/verify");
    }
  }, [user, loading, router]);

  function continueOnboarding(g: Gender) {
    setGender(g);
    router.push(`/onboarding?gender=${g}`);
  }

  if (loading) {
    return <p className="text-muted">Carregando…</p>;
  }

  return (
    <section className="animate-fade-up relative overflow-hidden pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-72 bg-[radial-gradient(ellipse_at_center,rgba(232,149,74,0.22),transparent_70%)]"
      />

      <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-ink sm:text-7xl">
        Chama
      </p>
      <h1 className="mt-4 max-w-xl text-xl text-ink/90 sm:text-2xl">
        Conversas reais, com verificação e créditos claros.
      </h1>
      <p className="mt-3 max-w-lg text-muted">
        Escolha como você entra. Pix e verificação facial são simulados neste
        localhost.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => continueOnboarding("homem")}
          className={`group rounded-3xl border p-6 text-left transition ${
            gender === "homem"
              ? "border-accent bg-accent/10"
              : "border-line bg-elevated/70 hover:border-accent/40"
          }`}
        >
          <p className="font-[family-name:var(--font-display)] text-2xl">Homem</p>
          <p className="mt-2 text-sm text-muted">
            Descubra criadoras verificadas, 10 msgs grátis/dia e créditos a
            R$0,40.
          </p>
        </button>
        <button
          type="button"
          onClick={() => continueOnboarding("mulher")}
          className={`group rounded-3xl border p-6 text-left transition ${
            gender === "mulher"
              ? "border-verified bg-verified/10"
              : "border-line bg-elevated/70 hover:border-verified/40"
          }`}
        >
          <p className="font-[family-name:var(--font-display)] text-2xl">Mulher</p>
          <p className="mt-2 text-sm text-muted">
            Painel de criadora: conversas, ganhos 50/50 e saque Pix do dia.
          </p>
        </button>
      </div>

      <p className="mt-8 text-sm text-muted">
        Já tem conta de teste? Abra o painel <span className="text-accent">Debug</span> no
        canto inferior direito.
      </p>
    </section>
  );
}
