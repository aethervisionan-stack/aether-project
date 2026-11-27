"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { MaleVipBar } from "@/components/VipProgress";
import { api, type PublicUser } from "@/lib/client";
import { CREDIT_PRICE_BRL, formatBrl } from "@/lib/vip";

const PACKS = [10, 25, 50, 100];

export default function CreditsPage() {
  const { user, setUser, loading } = useAuth();
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!loading && (!user || user.gender !== "homem")) {
    router.replace("/");
  }

  async function buy(pack?: string, customCredits?: number) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ user: PublicUser; notice: string }>("/api/credits/buy", {
        method: "POST",
        body: JSON.stringify({ pack, customCredits }),
      });
      setUser(data.user);
      setNotice(data.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na compra");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-muted">Carregando…</p>;

  return (
    <section className="animate-fade-up mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Créditos</h1>
        <p className="mt-2 text-muted">
          1 crédito = {formatBrl(CREDIT_PRICE_BRL)} = 1 mensagem paga após a cota
          grátis. Saldo: <span className="text-accent">{user.credits}</span>
        </p>
      </div>

      <MaleVipBar user={user} />

      <div className="grid grid-cols-2 gap-3">
        {PACKS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => void buy(String(n))}
            className="rounded-2xl border border-line bg-elevated/80 p-4 text-left transition hover:border-accent/50"
          >
            <p className="font-[family-name:var(--font-display)] text-2xl">{n}</p>
            <p className="text-sm text-muted">créditos</p>
            <p className="mt-2 text-accent">{formatBrl(n * CREDIT_PRICE_BRL)}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-elevated/60 p-4">
        <p className="mb-2 text-sm text-muted">Quantidade personalizada (sem teto)</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex: 37"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || !custom}
            onClick={() => void buy(undefined, Number(custom))}
            className="rounded-xl bg-accent px-4 py-2 font-medium text-[#1a120a] disabled:opacity-60"
          >
            Comprar
          </button>
        </div>
        {custom && Number(custom) > 0 && (
          <p className="mt-2 text-sm text-muted">
            Total Pix simulado: {formatBrl(Number(custom) * CREDIT_PRICE_BRL)}
          </p>
        )}
      </div>

      <p className="text-xs text-muted">
        Pagamento via Pix <strong className="text-ink">simulado</strong>. O gasto
        acumulado sobe seu VIP masculino automaticamente.
      </p>

      {notice && <p className="text-sm text-verified">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
