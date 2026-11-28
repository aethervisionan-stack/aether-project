"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { api, type PublicUser } from "@/lib/client";
import type { AppSettings, FreePhotoScope } from "@/lib/types";
import { formatBrl } from "@/lib/vip";

type Preset = {
  id: string;
  label: string;
  description: string;
  user: PublicUser | null;
};

type PlatformSummary = {
  paidMessagesPlatformBrl: number;
  paidPhotosPlatformBrl: number;
  hourPayCommittedBrl: number;
  withdrawalsBrl: number;
};

export function DebugPanel() {
  const { user, setUser, switchUser, refresh } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [platform, setPlatform] = useState<PlatformSummary | null>(null);
  const [maleLevel, setMaleLevel] = useState(6);
  const [femaleLevel, setFemaleLevel] = useState(2);
  const [hourRate, setHourRate] = useState(10);
  const [simMinutes, setSimMinutes] = useState(60);
  const [photoTarget, setPhotoTarget] = useState("debug-homem-comum");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadDebug() {
    const d = await api<{
      presets: Preset[];
      settings: AppSettings;
      platform: PlatformSummary;
    }>("/api/debug");
    setPresets(d.presets);
    setSettings(d.settings);
    setPlatform(d.platform);
    setHourRate(d.settings.defaultHourlyRateBrl);
  }

  useEffect(() => {
    if (!open) return;
    void loadDebug();
  }, [open, user?.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await action();
      await loadDebug();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  function goHomeFor(u: PublicUser) {
    if (!u.verified) router.push("/verify");
    else if (u.gender === "mulher") router.push("/creator");
    else router.push("/discover");
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="animate-fade-up max-h-[min(85vh,720px)] w-[min(100vw-2rem,24rem)] overflow-y-auto rounded-2xl border border-line bg-[#1a1511]/97 p-4 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-[family-name:var(--font-display)] text-lg text-accent">
              Debug local
            </p>
            <button
              type="button"
              className="text-sm text-muted hover:text-ink"
              onClick={() => setOpen(false)}
            >
              Fechar
            </button>
          </div>

          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Trocar conta</p>
          <div className="mb-4 flex flex-col gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await switchUser(p.id);
                    const data = await api<{ user: PublicUser }>("/api/me");
                    if (data.user) goHomeFor(data.user);
                    setMsg(`Sessão: ${p.label}`);
                  })
                }
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  user?.id === p.id
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-line bg-soft/60 text-ink hover:border-accent/50"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{p.description}</span>
              </button>
            ))}
          </div>

          {/* Free photo scope */}
          <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">
              Fotos grátis (3)
            </p>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["per_conversation", "3 free per conversation"],
                  ["per_male_user", "3 free per male user"],
                ] as [FreePhotoScope, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/api/debug", {
                        method: "POST",
                        body: JSON.stringify({
                          action: "set_settings",
                          freePhotoScope: value,
                        }),
                      });
                      setMsg(`Escopo fotos: ${label}`);
                    })
                  }
                  className={`rounded-lg border px-2 py-1.5 text-left text-xs ${
                    settings?.freePhotoScope === value
                      ? "border-accent bg-accent/15"
                      : "border-line"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={Boolean(settings?.includeHourPayInVip)}
                disabled={busy}
                onChange={(e) =>
                  run(async () => {
                    await api("/api/debug", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "set_settings",
                        includeHourPayInVip: e.target.checked,
                      }),
                    });
                    setMsg(
                      e.target.checked
                        ? "Hora online conta no VIP feminino"
                        : "VIP = só comissões (padrão)"
                    );
                  })
                }
              />
              Incluir hora online no VIP feminino
            </label>
          </div>

          {/* Photo test tools */}
          <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">Fotos teste</p>
            <select
              className="mb-2 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm"
              value={photoTarget}
              onChange={(e) => setPhotoTarget(e.target.value)}
            >
              <option value="debug-homem-comum">→ Homem Comum</option>
              <option value="debug-homem-vip">→ Homem VIP</option>
            </select>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-verified px-3 py-1.5 text-sm text-white"
                onClick={() =>
                  run(async () => {
                    if (user?.gender !== "mulher") {
                      await switchUser("debug-mulher-criadora");
                    }
                    const data = await api<{ notice: string }>("/api/debug", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "send_test_photo",
                        toUserId: photoTarget,
                      }),
                    });
                    setMsg(data.notice);
                    router.push(`/chat/${photoTarget}`);
                  })
                }
              >
                Enviar foto teste (criadora)
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
                onClick={() =>
                  run(async () => {
                    const data = await api<{ notice: string }>("/api/debug", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "reset_photo_counter",
                        userId: photoTarget,
                      }),
                    });
                    setMsg(data.notice);
                  })
                }
              >
                Resetar contador de fotos (alvo)
              </button>
            </div>
          </div>

          {/* Online hours debug */}
          <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">
              Hora online / taxa
            </p>
            <div className="mb-2 flex gap-2">
              <input
                type="number"
                className="w-20 rounded-lg border border-line bg-bg px-2 py-1 text-sm"
                value={hourRate}
                onChange={(e) => setHourRate(Number(e.target.value))}
              />
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-line px-2 text-xs"
                onClick={() =>
                  run(async () => {
                    if (user?.gender !== "mulher") {
                      await switchUser("debug-mulher-criadora");
                    }
                    const data = await api<{ user: PublicUser }>("/api/debug", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "set_hourly_rate",
                        hourlyRateBrl: hourRate,
                      }),
                    });
                    setUser(data.user);
                    setMsg(`Taxa R$ ${hourRate}/h`);
                  })
                }
              >
                Set taxa
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                className="w-20 rounded-lg border border-line bg-bg px-2 py-1 text-sm"
                value={simMinutes}
                onChange={(e) => setSimMinutes(Number(e.target.value))}
              />
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-medium text-[#1a120a]"
                onClick={() =>
                  run(async () => {
                    if (user?.gender !== "mulher") {
                      await switchUser("debug-mulher-criadora");
                    }
                    const data = await api<{ user: PublicUser; notice: string }>(
                      "/api/debug",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          action: "simulate_online_hours",
                          minutes: simMinutes,
                        }),
                      }
                    );
                    setUser(data.user);
                    setMsg(data.notice);
                    router.push("/creator");
                  })
                }
              >
                Simular minutos online
              </button>
            </div>
          </div>

          {user?.gender === "homem" && (
            <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                VIP masculino
              </p>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm"
                  value={maleLevel}
                  onChange={(e) => setMaleLevel(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      VIP{n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-[#1a120a]"
                  onClick={() =>
                    run(async () => {
                      const data = await api<{ user: PublicUser }>("/api/debug", {
                        method: "POST",
                        body: JSON.stringify({
                          action: "set_male_vip",
                          level: maleLevel,
                        }),
                      });
                      setUser(data.user);
                      setMsg(`VIP masculino → VIP${maleLevel}`);
                    })
                  }
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          {user?.gender === "mulher" && (
            <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                VIP criadora
              </p>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm"
                  value={femaleLevel}
                  onChange={(e) => setFemaleLevel(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      VIP{n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-verified px-3 py-1.5 text-sm font-medium text-white"
                  onClick={() =>
                    run(async () => {
                      const data = await api<{ user: PublicUser }>("/api/debug", {
                        method: "POST",
                        body: JSON.stringify({
                          action: "set_female_vip",
                          level: femaleLevel,
                        }),
                      });
                      setUser(data.user);
                      setMsg(`VIP criadora → VIP${femaleLevel}`);
                    })
                  }
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          {platform && (
            <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3 text-xs">
              <p className="mb-2 uppercase tracking-wider text-muted">
                Ledger plataforma
              </p>
              <ul className="space-y-1 text-ink/90">
                <li>Msgs pagas (R$0,20): {formatBrl(platform.paidMessagesPlatformBrl)}</li>
                <li>Fotos pagas (R$1,00): {formatBrl(platform.paidPhotosPlatformBrl)}</li>
                <li>Hora online comprometida: {formatBrl(platform.hourPayCommittedBrl)}</li>
                <li>Saques: {formatBrl(platform.withdrawalsBrl)}</li>
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            className="w-full rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
            onClick={() =>
              run(async () => {
                await api("/api/debug", {
                  method: "POST",
                  body: JSON.stringify({ action: "reset" }),
                });
                await refresh();
                setMsg("Banco reinicializado");
                router.push("/");
              })
            }
          >
            Resetar banco JSON
          </button>

          {msg && <p className="mt-2 text-xs text-verified">{msg}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line bg-[#1a1511]/95 px-4 py-2 text-sm font-medium text-accent shadow-lg shadow-black/40 backdrop-blur hover:border-accent/50"
      >
        {open ? "Debug ▾" : "Debug · simulação"}
      </button>
    </div>
  );
}
