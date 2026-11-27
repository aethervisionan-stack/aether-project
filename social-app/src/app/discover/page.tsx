"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { MaleVipBar } from "@/components/VipProgress";
import { api, type PublicUser } from "@/lib/client";
import { formatBrl } from "@/lib/vip";

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<PublicUser[]>([]);

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
    if (user.gender !== "homem") {
      router.replace("/creator");
      return;
    }
    void api<{ users: PublicUser[] }>("/api/users?gender=mulher&verified=1").then(
      (d) => setProfiles(d.users.filter((u) => u.id !== user.id))
    );
  }, [user, loading, router]);

  if (loading || !user) return <p className="text-muted">Carregando…</p>;

  const free = user.freeMessages.remaining;

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          Descobrir
        </h1>
        <p className="mt-2 text-muted">
          Criadoras verificadas · msgs grátis restantes hoje:{" "}
          <span className="text-accent">
            {free === "unlimited" ? "ilimitadas" : free}
          </span>
          {" · "}
          créditos: <span className="text-ink">{user.credits}</span> (
          {formatBrl(user.credits * 0.4)})
        </p>
      </div>

      <MaleVipBar user={user} />

      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map((p, i) => (
          <Link
            key={p.id}
            href={`/chat/${p.id}`}
            className="animate-fade-up group overflow-hidden rounded-3xl border border-line bg-elevated/70 transition hover:border-accent/40"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.photoUrl}
              alt=""
              className="aspect-[5/4] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <p className="font-[family-name:var(--font-display)] text-xl">
                  {p.name}, {p.age}
                </p>
                <span className="rounded-md bg-verified/20 px-1.5 py-0.5 text-[11px] font-medium text-verified">
                  Verificada
                </span>
                {p.femaleVip.current && (
                  <span className="rounded-md bg-vip/15 px-1.5 py-0.5 text-[11px] text-vip">
                    VIP{p.femaleVip.current.level}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{p.bio}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
