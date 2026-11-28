"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [installReady, setInstallReady] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW register failed", err));

    const onBip = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      setDeferred({
        prompt: async () => {
          await ev.prompt();
          await ev.userChoice;
          setInstallReady(false);
          setDeferred(null);
        },
      });
      setInstallReady(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!installReady || !deferred) return null;

  return (
    <button
      type="button"
      onClick={() => void deferred.prompt()}
      className="fixed bottom-20 left-4 z-50 rounded-full border border-line bg-[#1a1511]/95 px-4 py-2 text-sm font-medium text-accent shadow-lg backdrop-blur hover:border-accent/50"
    >
      Instalar app
    </button>
  );
}
