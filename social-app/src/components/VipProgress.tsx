import { formatBrl } from "@/lib/vip";
import type { PublicUser } from "@/lib/client";

export function MaleVipBar({ user }: { user: PublicUser }) {
  const { current, next, progress, spendBrl } = user.maleVip;
  return (
    <div className="rounded-2xl border border-line bg-elevated/80 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">VIP masculino</p>
          <p className="font-[family-name:var(--font-display)] text-xl text-vip">
            {current ? current.label : "Sem VIP"}
          </p>
        </div>
        <p className="text-sm text-muted">
          Gasto: <span className="text-ink">{formatBrl(spendBrl)}</span>
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-soft">
        <div
          className="progress-fill h-full rounded-full bg-gradient-to-r from-accent-deep to-vip"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        {next
          ? `Próximo: ${next.label} em ${formatBrl(next.minSpendBrl)}`
          : "Nível máximo alcançado"}
        {current && (
          <>
            {" "}
            · Msgs grátis/dia:{" "}
            {current.freeMessagesPerDay === "unlimited"
              ? "ilimitadas"
              : `base 10 + ${current.freeMessagesPerDay}`}
            {" · "}
            vídeo:{" "}
            {current.videoMinutes === "unlimited"
              ? "ilimitado"
              : `${current.videoMinutes} min`}
          </>
        )}
        {!current && <> · Msgs grátis/dia: base 10</>}
      </p>
    </div>
  );
}

export function FemaleVipBar({ user }: { user: PublicUser }) {
  const { current, next, progress, earningsBrl } = user.femaleVip;
  return (
    <div className="rounded-2xl border border-line bg-elevated/80 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            VIP criadora · comissões
          </p>
          <p className="font-[family-name:var(--font-display)] text-xl text-vip">
            {current ? `VIP${current.level} · ${current.title}` : "Sem VIP"}
          </p>
        </div>
        <p className="text-sm text-muted">
          Ganhos: <span className="text-ink">{formatBrl(earningsBrl)}</span>
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-soft">
        <div
          className="progress-fill h-full rounded-full bg-gradient-to-r from-verified to-vip"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        {next
          ? `Próximo: VIP${next.level} (${next.title}) em ${formatBrl(next.minEarningsBrl)} · bônus ${formatBrl(next.bonusBrl)}`
          : "Lenda da Rede — nível máximo"}
      </p>
      {current && (
        <p className="mt-1 text-sm text-ink/80">{current.perks.join(" · ")}</p>
      )}
    </div>
  );
}
