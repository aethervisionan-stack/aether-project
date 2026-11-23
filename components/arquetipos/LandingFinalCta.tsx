"use client";

type Props = {
  onStartQuiz: () => void;
};

export function LandingFinalCta({ onStartQuiz }: Props) {
  return (
    <section
      id="comecar"
      className="scroll-mt-20 border-t border-white/8 px-5 py-20 text-center sm:py-24"
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="font-[family-name:var(--font-arq-display)] text-3xl tracking-tight text-[#F3EDE0] sm:text-4xl">
          Pronto para ver o arquétipo que te guia?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-[#F3EDE0]/55">
          Doze perguntas. Resultado imediato. Sem cadastro obrigatório.
        </p>
        <button
          type="button"
          onClick={onStartQuiz}
          className="mt-8 bg-gradient-to-r from-[#C9A227] via-[#E0B84A] to-[#C9A227] bg-[length:200%_100%] px-7 py-3.5 text-sm font-semibold tracking-wide text-[#0a0a0c] transition-[background-position] duration-500 hover:bg-[position:100%_0]"
        >
          Iniciar Teste Gratuito
        </button>
      </div>
    </section>
  );
}
