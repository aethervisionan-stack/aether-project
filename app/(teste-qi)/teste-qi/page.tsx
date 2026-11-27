import dynamic from "next/dynamic";

/** TestLineQi (`testlineqi`) — IQ assessment at `/teste-qi`. Do not break payment/IA/logo. */

const IqTestApp = dynamic(
  () =>
    import("@/src/components/IqTestApp").then((m) => ({
      default: m.IqTestApp,
    })),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-400">
        Carregando…
      </div>
    ),
  },
);

export default function TesteQiPage() {
  return <IqTestApp />;
}
