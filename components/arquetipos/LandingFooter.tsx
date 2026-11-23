"use client";

type Props = {
  onStartQuiz: () => void;
};

export function LandingFooter({ onStartQuiz }: Props) {
  return (
    <footer className="border-t border-[color:var(--cine-border-soft)]">
      <div className="px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-[color:var(--cine-dim)] sm:flex-row">
          <p className="cine-display text-sm tracking-[0.22em] text-[color:var(--cine-amber)]/80">
            ARCANUM • XII
          </p>
          <p>Jung · Dark Fantasy</p>
          <button
            type="button"
            onClick={onStartQuiz}
            className="text-[color:var(--cine-amber)] transition hover:text-[color:var(--cine-amber-soft)]"
          >
            Começar Teste
          </button>
        </div>
      </div>
    </footer>
  );
}
