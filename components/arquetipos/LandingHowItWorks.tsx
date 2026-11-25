"use client";

const STEPS = [
  {
    n: "01",
    title: "Reação sob Pressão e Crise",
    body: "Quatro dilemas sobre estouro de prazo, crítica pública, crise familiar e o que você precisa no imprevisto.",
  },
  {
    n: "02",
    title: "Poder, Regras e Autonomia",
    body: "Regras absurdas, oferta de poder, microgerenciamento e o preço de falar a verdade.",
  },
  {
    n: "03",
    title: "Vínculos e Vulnerabilidade",
    body: "Honestidade que fere, dar mais do que recebe, deslocamento social e pedidos de ajuda sob sobrecarga.",
  },
  {
    n: "04",
    title: "Ambição e Autossabotagem",
    body: "Lançar o imperfeito, padrões de sabotagem, exposição pública e o que trava o legado.",
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
          16 perguntas em 4 eixos
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
