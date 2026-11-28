"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { FemaleVipBar } from "@/components/VipProgress";
import { api, type PublicUser } from "@/lib/client";
import { formatBrl } from "@/lib/vip";
import type { LedgerEntry, ShiftStatus, Withdrawal } from "@/lib/types";

type Conv = {
  id: string;
  lastMessagePreview: string;
  updatedAt: string;
  other: PublicUser | null;
};

const SHIFT_LABEL: Record<ShiftStatus, string> = {
  offline: "Offline",
  active: "Em Turno Ativo",
  paused: "Pausado",
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
  const [rateInput, setRateInput] = useState("10");
  const [simMinutes, setSimMinutes] = useState("15");
  const [activityTarget, setActivityTarget] = useState(50);

  async function loadExtras() {
    const [msgs, hist, online] = await Promise.all([
      api<{ conversations: Conv[] }>("/api/messages"),
      api<{ ledger: LedgerEntry[]; withdrawals: Withdrawal[] }>("/api/withdraw"),
      api<{ user: PublicUser; activityTarget: number }>("/api/online"),
    ]);
    setConversations(msgs.conversations);
    setLedger(hist.ledger.slice(0, 40));
    setWithdrawals(hist.withdrawals.slice(0, 10));
    setUser(online.user);
    setRateInput(String(online.user.hourlyRateBrl));
    setActivityTarget(online.activityTarget);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, router]);

  async function withdraw() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ user: PublicUser; notice: string }>("/api/withdraw", {
        method: "POST",
      });
      setUser(data.user);
      setNotice(data.notice);
      await loadExtras();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no saque");
    } finally {
      setBusy(false);
    }
  }

  async function onlineAction(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await api<{ user: PublicUser; notice?: string }>("/api/online", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(data.user);
      if (data.notice) setNotice(data.notice);
      await loadExtras();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-muted">Carregando…</p>;

  const hours = user.onlineHoursToday ?? user.onlineMinutesToday / 60;
  const activityPct = Math.min(
    100,
    Math.round((user.activityScore / 100) * 100) ||
      Math.min(100, Math.round((user.onlineMinutesToday / activityTarget) * 100))
  );

  const ledgerGroups = {
    hour: ledger.filter((e) => e.type === "creator_online_hour"),
    message: ledger.filter(
      (e) => e.type === "creator_message" || e.type === "creator_earning"
    ),
    photo: ledger.filter((e) => e.type === "creator_photo"),
    vip: ledger.filter((e) => e.type === "vip_bonus"),
  };

  return (
    <section className="animate-fade-up space-y-6 pb-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          Painel criadora
        </h1>
        <p className="mt-2 text-muted">
          Comissões (msgs R$0,20 · fotos R$1,00) + Hora Online. VIP = comissões (hora só se
          debug ligar).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-elevated/80 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Saldo disponível</p>
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
            Comissões (base VIP)
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-4xl">
            {formatBrl(user.cumulativeEarningsBrl)}
          </p>
          <p className="mt-2 text-sm text-muted">
            Hora online acumulada: {formatBrl(user.cumulativeHourPayBrl)}
          </p>
        </div>
      </div>

      <FemaleVipBar user={user} />

      {/* Hora Online Remunerada */}
      <div className="rounded-3xl border border-line bg-elevated/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Hora Online Remunerada
            </h2>
            <p className="mt-1 text-sm text-muted">Fase inicial — simulação local</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              user.shiftStatus === "active"
                ? "bg-verified/20 text-verified"
                : user.shiftStatus === "paused"
                  ? "bg-vip/20 text-vip"
                  : "bg-soft text-muted"
            }`}
          >
            {SHIFT_LABEL[user.shiftStatus]}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-muted">R$/hora</span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg px-3 py-2"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onlineAction({
                    action: "set_rate",
                    hourlyRateBrl: Number(rateInput),
                  })
                }
                className="rounded-xl border border-line px-3 text-sm"
              >
                OK
              </button>
            </div>
          </label>
          <div className="text-sm">
            <p className="text-muted">Horas hoje</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
              {hours.toFixed(2)} h
            </p>
            <p className="text-xs text-muted">{user.onlineMinutesToday} min</p>
          </div>
          <div className="text-sm">
            <p className="text-muted">Meta de atividade /h</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
              <div
                className="h-full rounded-full bg-gradient-to-r from-verified to-accent"
                style={{ width: `${activityPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              {activityPct}% · alvo {activityTarget} min ativos/hora
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["offline", "active", "paused"] as ShiftStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void onlineAction({ action: "set_status", status: s })}
              className={`rounded-xl border px-3 py-2 text-sm ${
                user.shiftStatus === s
                  ? "border-accent bg-accent/15"
                  : "border-line hover:border-accent/40"
              }`}
            >
              {SHIFT_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onlineAction({ action: "add_hour" })}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[#1a120a]"
          >
            +1h turno online
          </button>
          <input
            type="number"
            min={1}
            value={simMinutes}
            onChange={(e) => setSimMinutes(e.target.value)}
            className="w-24 rounded-xl border border-line bg-bg px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onlineAction({
                action: "simulate_minutes",
                minutes: Number(simMinutes),
              })
            }
            className="rounded-xl border border-line px-4 py-2 text-sm"
          >
            Simular X minutos
          </button>
        </div>
      </div>

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

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Ledger (linhas separadas)
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Hora Online", ledgerGroups.hour],
              ["Mensagens pagas R$0,20", ledgerGroups.message],
              ["Fotos pagas R$1,00", ledgerGroups.photo],
              ["Bônus VIP Feminino", ledgerGroups.vip],
            ] as const
          ).map(([title, rows]) => (
            <div key={title} className="rounded-2xl border border-line bg-soft/30 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">{title}</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {rows.length === 0 && <li className="text-muted">—</li>}
                {rows.map((e) => (
                  <li key={e.id}>
                    <span className={e.amountBrl >= 0 ? "text-verified" : "text-danger"}>
                      {formatBrl(e.amountBrl)}
                    </span>{" "}
                    <span className="text-muted">{e.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Saques Pix</h2>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
          {withdrawals.map((w) => (
            <li key={w.id} className="rounded-xl border border-line bg-soft/40 px-3 py-2">
              <span className="text-accent">{formatBrl(w.amountBrl)}</span>
              <span className="ml-2 text-muted">
                {new Date(w.createdAt).toLocaleString("pt-BR")} · {w.note}
              </span>
            </li>
          ))}
          {withdrawals.length === 0 && <li className="text-muted">Nenhum saque ainda.</li>}
        </ul>
      </div>
    </section>
  );
}
