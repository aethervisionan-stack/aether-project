import { utilities } from "@/lib/content";

export function Utility() {
  return (
    <section id="utilidade" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs uppercase tracking-[0.22em] text-neon">Utilidade</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">Para que serve o AETH</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {utilities.map((item) => (
            <article key={item.title} className="rounded-2xl border border-line bg-surface p-6">
              <h3 className="font-display text-xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
