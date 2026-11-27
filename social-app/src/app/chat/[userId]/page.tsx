"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type PublicUser } from "@/lib/client";
import type { Message } from "@/lib/types";

export default function ChatPage() {
  const { userId: otherId } = useParams<{ userId: string }>();
  const { user, setUser, loading } = useAuth();
  const router = useRouter();
  const [other, setOther] = useState<PublicUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [usersRes, msgsRes] = await Promise.all([
      api<{ users: PublicUser[] }>("/api/users"),
      api<{ messages: Message[] }>(`/api/messages?with=${otherId}`),
    ]);
    setOther(usersRes.users.find((u) => u.id === otherId) ?? null);
    setMessages(msgsRes.messages);
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
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, otherId, loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{
        message: Message;
        from: PublicUser;
        needsCredits?: boolean;
      }>("/api/messages", {
        method: "POST",
        body: JSON.stringify({ toUserId: otherId, text }),
      });
      setMessages((m) => [...m, data.message]);
      setUser(data.from);
      setText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-muted">Carregando…</p>;

  const free = user.freeMessages.remaining;

  return (
    <section className="animate-fade-up flex h-[min(70vh,640px)] flex-col">
      <div className="mb-4 flex items-center gap-3 border-b border-line pb-3">
        <Link href={user.gender === "mulher" ? "/inbox" : "/discover"} className="text-muted">
          ←
        </Link>
        {other && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={other.photoUrl}
              alt=""
              className="h-10 w-10 rounded-full border border-line object-cover"
            />
            <div>
              <p className="font-medium">
                {other.name}{" "}
                <span className="text-xs text-verified">✓</span>
              </p>
              <p className="text-xs text-muted">{other.bio.slice(0, 48)}</p>
            </div>
          </>
        )}
      </div>

      {user.gender === "homem" && (
        <p className="mb-3 text-xs text-muted">
          Grátis hoje:{" "}
          <span className="text-accent">
            {free === "unlimited" ? "∞" : free}
          </span>
          {" · "}
          créditos: {user.credits} · 1 crédito = R$0,40 (R$0,20 plataforma + R$0,20
          criadora)
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-elevated/40 p-4">
        {messages.map((m) => {
          const mine = m.fromUserId === user.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-accent/20 text-ink"
                    : "bg-soft text-ink"
                }`}
              >
                <p>{m.text}</p>
                {m.paid && (
                  <p className="mt-1 text-[10px] text-muted">
                    Paga · plat {m.platformShareBrl.toFixed(2)} · criadora{" "}
                    {m.creatorShareBrl.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger">
          {error}{" "}
          {error.toLowerCase().includes("crédito") && (
            <Link href="/credits" className="underline text-accent">
              Comprar créditos
            </Link>
          )}
        </p>
      )}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          className="flex-1 rounded-xl border border-line bg-elevated px-3 py-2.5 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-accent px-4 py-2 font-medium text-[#1a120a] disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </section>
  );
}
