"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { api, type PublicUser } from "@/lib/client";

type Preset = {
  id: string;
  label: string;
  description: string;
  user: PublicUser | null;
};

export function DebugPanel() {
  const { user, setUser, switchUser, refresh } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [maleLevel, setMaleLevel] = useState(6);
  const [femaleLevel, setFemaleLevel] = useState(2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    void api<{ presets: Preset[] }>("/api/debug").then((d) => setPresets(d.presets));
  }, [open, user?.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await action();
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
        <div className="animate-fade-up w-[min(100vw-2rem,22rem)] rounded-2xl border border-line bg-[#1a1511]/97 p-4 shadow-2xl shadow-black/50 backdrop-blur">
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

          {user?.gender === "homem" && (
            <div className="mb-3 rounded-xl border border-line bg-soft/40 p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                Simular gasto / VIP masculino
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
                Simular ganhos / VIP criadora
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
                      setMsg(`VIP criadora → VIP${femaleLevel} (bônus creditados)`);
                    })
                  }
                >
                  Aplicar
                </button>
              </div>
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
