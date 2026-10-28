import { tokenomics } from "@/lib/content";

const hues = ["#00F0FF", "#5CFFF2", "#2BB8C4", "#148A96", "#0D5C66", "#083840"];

export function Tokenomics() {
  const stops = tokenomics.allocations.reduce<{ css: string; cursor: number }>(
    (acc, slice, i) => {
      const next = acc.cursor + slice.pct;
      acc.css += `${hues[i]} ${acc.cursor}% ${next}%${i < tokenomics.allocations.length - 1 ? ", " : ""}`;
      acc.cursor = next;
      return acc;
    },
    { css: "", cursor: 0 },
  );

  return (
    <section id="tokenomics" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs uppercase tracking-[0.22em] text-neon">Tokenomics</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">AETH, supply fechado</h2>
        <p className="mt-4 max-w-2xl text-muted">
          {tokenomics.maxSupply.toLocaleString("pt-PT")} AETH. {tokenomics.unit}. {tokenomics.mint}.
        </p>
        <div className="mt-12 grid items-center gap-12 md:grid-cols-[220px_1fr]">
          <div
            aria-hidden
            className="mx-auto size-52 rounded-full"
            style={{
              background: `conic-gradient(${stops.css})`,
              boxShadow: "0 0 40px rgba(0,240,255,0.2)",
              mask: "radial-gradient(circle, transparent 52%, black 53%)",
              WebkitMask: "radial-gradient(circle, transparent 52%, black 53%)",
            }}
          />
          <ul className="space-y-4">
            {tokenomics.allocations.map((row, i) => (
              <li key={row.label} className="flex items-start justify-between gap-4 border-b border-line pb-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: hues[i] }}
                  />
                  <div>
                    <p className="font-medium">{row.label}</p>
                    <p className="text-sm text-muted">{row.detail}</p>
                  </div>
                </div>
                <span className="font-display text-neon">{row.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
