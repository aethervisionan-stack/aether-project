"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { FemaleVipBar } from "@/components/VipProgress";
import { api, type PublicUser } from "@/lib/client";
import { formatBrl } from "@/lib/vip";
import type { LedgerEntry, Withdrawal } from "@/lib/types";

type Conv = {
  id: string;
  lastMessagePreview: string;
  updatedAt: string;
  other: PublicUser | null;
};

export default function CreatorPage() {
  const { user, setUser, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadExtras() {
    const [msgs, hist] = await Promise.all([
      api<{ conversations: Conv[] }>("/api/messages"),
      api<{ ledger: LedgerEntry[]; withdrawals: Withdrawal[] }>("/api/withdraw"),
    ]);
    setConversations(msgs.conversations);
    setLedger(hist.ledger.slice(0, 20));
    setWithdrawals(hist.withdrawals.slice(0, 10));
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!user.verified) {
      router.replace("/verify");
      return;
    }
    if (user.gender !== "mulher") {
      router.replace("/discover");
      return;
    }
    void loadExtras();
  }, [user?.id, loading, router]);

  async function withdraw() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{
        user: PublicUser;
        notice: string;
      }>("/api/withdraw", { method: "POST" });
      setUser(data.user);
      setNotice(data.notice);
      await loadExtras();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no saque");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-muted">Carregando…</p>;

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          Painel criadora
        </h1>
        <p className="mt-2 text-muted">
          Cada mensagem paga rende {formatBrl(0.2)} para você (50/50 com a plataforma).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-elevated/80 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Saldo disponível
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-4xl text-accent">
            {formatBrl(user.balanceBrl)}
          </p>
          <button
            type="button"
            disabled={busy || user.balanceBrl <= 0}
            onClick={() => void withdraw()}
            className="mt-4 w-full rounded-2xl bg-verified px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Sacar saldo do dia via Pix
          </button>
        </div>
        <div className="rounded-3xl border border-line bg-elevated/80 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Ganhos acumulados
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-4xl">
            {formatBrl(user.cumulativeEarningsBrl)}
          </p>
          <p className="mt-2 text-sm text-muted">Base do VIP feminino (12 níveis)</p>
        </div>
      </div>

      <FemaleVipBar user={user} />

      {notice && <p className="text-sm text-verified">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Conversas</h2>
        <div className="mt-3 space-y-2">
          {conversations.length === 0 && (
            <p className="text-sm text-muted">Nenhuma conversa ainda.</p>
          )}
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={c.other ? `/chat/${c.other.id}` : "#"}
              className="flex items-center gap-3 rounded-2xl border border-line bg-elevated/50 p-3 hover:border-accent/40"
            >
              {c.other && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.other.photoUrl}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.other?.name ?? "—"}</p>
                <p className="truncate text-sm text-muted">{c.lastMessagePreview}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Histórico de ganhos
          </h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {ledger
              .filter((e) =>
                ["creator_earning", "vip_bonus", "withdrawal"].includes(e.type)
              )
              .map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-line bg-soft/40 px-3 py-2"
                >
                  <span
                    className={
                      e.amountBrl >= 0 ? "text-verified" : "text-danger"
                    }
                  >
                    {formatBrl(e.amountBrl)}
                  </span>
                  <span className="ml-2 text-muted">{e.description}</span>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Saques Pix
          </h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className="rounded-xl border border-line bg-soft/40 px-3 py-2"
              >
                <span className="text-accent">{formatBrl(w.amountBrl)}</span>
                <span className="ml-2 text-muted">
                  {new Date(w.createdAt).toLocaleString("pt-BR")} · {w.note}
                </span>
              </li>
            ))}
            {withdrawals.length === 0 && (
              <li className="text-muted">Nenhum saque ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
