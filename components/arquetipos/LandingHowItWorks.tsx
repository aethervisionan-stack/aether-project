"use client";

const STEPS = [
  {
    n: "01",
    title: "Doze situações reais",
    body: "Escolha a resposta que mais soa como você — sem certo ou errado.",
  },
  {
    n: "02",
    title: "Leitura do perfil",
    body: "Cruzamos padrões de motivação, desejo e sombra arquetípica.",
  },
  {
    n: "03",
    title: "Resultado aplicável",
    body: "Dominante + secundário, lema, forças, sombras e uso em vida e negócios.",
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
          Menos de dois minutos. Resultado completo.
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
