"use client";

type Props = {
  onStartQuiz: () => void;
};

export function LandingFooter({ onStartQuiz }: Props) {
  return (
    <footer className="border-t border-[color:var(--grim-border-soft)]">
      <div className="px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-[color:var(--grim-stone-dim)] sm:flex-row">
          <p className="grim-display text-base tracking-[0.12em] text-[color:var(--grim-gold)]/70">
            Arquétipo
          </p>
          <p>Carol Pearson / Jung · Dark Fantasy Grimoire</p>
          <button
            type="button"
            onClick={onStartQuiz}
            className="text-[color:var(--grim-gold)] transition hover:text-[color:var(--grim-gold-bright)]"
          >
            Começar Teste
          </button>
        </div>
      </div>
    </footer>
  );
}
