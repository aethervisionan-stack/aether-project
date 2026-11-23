"use client";

type Props = {
  onStartQuiz: () => void;
};

export function LandingFooter({ onStartQuiz }: Props) {
  return (
    <footer className="border-t border-[color:var(--cart-border-soft)]">
      <div className="px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-[color:var(--cart-dim)] sm:flex-row">
          <p className="cart-display text-base tracking-[0.12em] text-[color:var(--cart-copper)]/75">
            Arquétipo
          </p>
          <p>Carol Pearson / Jung · Carta de Expedição</p>
          <button
            type="button"
            onClick={onStartQuiz}
            className="text-[color:var(--cart-copper)] transition hover:text-[color:var(--cart-copper-bright)]"
          >
            Iniciar Expedição
          </button>
        </div>
      </div>
    </footer>
  );
}
