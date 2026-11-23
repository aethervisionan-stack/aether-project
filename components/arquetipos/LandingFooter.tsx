"use client";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/8 px-5 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-[#F3EDE0]/35 sm:flex-row">
        <p className="font-[family-name:var(--font-arq-display)] text-base text-[#F3EDE0]/55">
          Arquétipo
        </p>
        <p>
          Quiz dos 12 arquétipos · pt-BR ·{" "}
          <a href="/aether" className="text-[#F3EDE0]/45 transition hover:text-[#E8C547]">
            Aether Vision
          </a>
        </p>
      </div>
    </footer>
  );
}
