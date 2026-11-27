"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const links =
    user?.verified && user.gender === "homem"
      ? [
          { href: "/discover", label: "Descobrir" },
          { href: "/credits", label: "Créditos" },
        ]
      : user?.verified && user.gender === "mulher"
        ? [
            { href: "/creator", label: "Painel" },
            { href: "/inbox", label: "Conversas" },
          ]
        : [];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-5xl flex-col px-4 pb-28 pt-4 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="group">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-ink sm:text-3xl">
            Chama
          </p>
          <p className="text-xs text-muted transition group-hover:text-accent">
            Aether Social · protótipo
          </p>
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">
                {user.verified ? (
                  <span className="text-verified">✓ Verificado</span>
                ) : (
                  "Não verificado"
                )}
                {user.gender === "homem" && (
                  <> · {user.credits} créditos</>
                )}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.photoUrl}
              alt=""
              className="h-10 w-10 rounded-full border border-line object-cover"
            />
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {links.length > 0 && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-[#12100e]/92 backdrop-blur">
          <div className="mx-auto flex max-w-5xl justify-around px-4 py-3">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm font-medium ${
                    active ? "text-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
