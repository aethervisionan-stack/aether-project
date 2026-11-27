"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type PublicUser } from "@/lib/client";

type Conv = {
  id: string;
  lastMessagePreview: string;
  updatedAt: string;
  other: PublicUser | null;
};

export default function InboxPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conv[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user?.verified) {
      router.replace(user ? "/verify" : "/");
      return;
    }
    void api<{ conversations: Conv[] }>("/api/messages").then((d) =>
      setConversations(d.conversations)
    );
  }, [user, loading, router]);

  if (loading || !user) return <p className="text-muted">Carregando…</p>;

  return (
    <section className="animate-fade-up space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Conversas</h1>
      {conversations.length === 0 && (
        <p className="text-muted">Nenhuma conversa ainda.</p>
      )}
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={c.other ? `/chat/${c.other.id}` : "#"}
          className="flex items-center gap-3 rounded-2xl border border-line bg-elevated/60 p-3 hover:border-accent/40"
        >
          {c.other && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.other.photoUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="font-medium">{c.other?.name}</p>
            <p className="truncate text-sm text-muted">{c.lastMessagePreview}</p>
          </div>
        </Link>
      ))}
    </section>
  );
}
