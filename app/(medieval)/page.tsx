import dynamic from "next/dynamic";

/** Quiz Medieval (`quiz-medieval`) — brand ARCANUM • XII. Canonical route `/`. */

const ArchetypeQuizApp = dynamic(
  () =>
    import("@/components/arquetipos/ArchetypeQuizApp").then((m) => ({
      default: m.ArchetypeQuizApp,
    })),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm opacity-70">
        Carregando…
      </div>
    ),
  },
);

export default function Page() {
  return <ArchetypeQuizApp />;
}
