"use client";

const STEPS = [
  {
    n: "01",
    title: "Motivação e Propósito",
    body: "Quatro perguntas sobre realização, frustração, crise e como você aparece para os outros.",
  },
  {
    n: "02",
    title: "Comportamento e Decisões",
    body: "Papel em equipe, lema de vida, relacionamentos e o que faria com um ano sabático.",
  },
  {
    n: "03",
    title: "Medos e Legado",
    body: "Medo interno, orgulho no trabalho, ambiente ideal e o legado que quer deixar.",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-t border-white/8 px-5 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#C9A227]">
          Como funciona
        </p>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-arq-display)] text-3xl tracking-tight text-[#F3EDE0] sm:text-4xl">
          12 perguntas em 3 etapas
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <p className="font-[family-name:var(--font-arq-display)] text-3xl text-[#C9A227]/80">
                {step.n}
              </p>
              <h3 className="mt-3 text-lg text-[#F3EDE0]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#F3EDE0]/55">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
