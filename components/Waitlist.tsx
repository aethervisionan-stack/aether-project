"use client";

import { FormEvent, useState } from "react";

export function Waitlist() {
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(true);
  }

  return (
    <section id="waitlist" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="glow-neon rounded-3xl bg-surface px-6 py-12 md:px-12">
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">
            Entra na lista do Aether Lite
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            O lançamento é faseado. Deixa o email e avisamos quando o cliente leve abrir vagas.
          </p>
          {done ? (
            <p className="mt-8 text-neon">Estás na lista. Vemos-te no Lite.</p>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="teu@email"
                className="flex-1 rounded-full border border-line bg-onyx px-5 py-3 text-sm outline-none ring-neon placeholder:text-muted focus:ring-1"
              />
              <button
                type="submit"
                className="rounded-full bg-neon px-6 py-3 text-sm font-medium text-onyx"
              >
                Quero o Lite
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
