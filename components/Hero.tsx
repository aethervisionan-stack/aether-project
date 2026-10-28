export function Hero() {
  return (
    <section id="topo" className="grid-aether relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,240,255,0.12),transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.22em] text-neon">
          Lançamento público
        </p>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
          Aether Lite
          <span className="block text-neon">o cliente leve do AETH</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          O primeiro cliente do protocolo Aether. Carteira, taxas e envio sem full node — sobre
          fundo Onyx Black, com o Ether Neon a marcar o que importa.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#waitlist"
            className="glow-neon rounded-full bg-neon px-6 py-3 text-sm font-medium text-onyx"
          >
            Pedir acesso ao Lite
          </a>
          <a
            href="#tokenomics"
            className="rounded-full border border-line px-6 py-3 text-sm text-ink transition hover:border-neon hover:text-neon"
          >
            Ver tokenomics AETH
          </a>
        </div>
      </div>
    </section>
  );
}
