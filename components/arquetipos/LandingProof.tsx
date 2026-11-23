"use client";

const QUOTES = [
  {
    text: "Pela primeira vez vi com clareza por que eu lidero do jeito que lidero — e onde isso me custa.",
    who: "Marina, estrategista",
  },
  {
    text: "O secundário explicou meu conflito interno. Usei o lema no posicionamento da marca em uma semana.",
    who: "Rafael, fundador",
  },
  {
    text: "Rápido, sem enrolação. O mapa de sombras valeu mais do que testes longos que já fiz.",
    who: "Helena, designer",
  },
] as const;

export function LandingProof() {
  return (
    <section
      id="prova"
      className="scroll-mt-20 border-t border-white/8 px-5 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#C9A227]">
          Quem já fez
        </p>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-arq-display)] text-3xl tracking-tight text-[#F3EDE0] sm:text-4xl">
          Clareza que vira conversa e posicionamento
        </h2>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {QUOTES.map((q) => (
            <li
              key={q.who}
              className="border-l-2 border-[#C9A227]/45 pl-5"
            >
              <blockquote className="font-[family-name:var(--font-arq-display)] text-lg italic leading-snug text-[#F3EDE0]/85">
                “{q.text}”
              </blockquote>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#F3EDE0]/40">
                {q.who}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
