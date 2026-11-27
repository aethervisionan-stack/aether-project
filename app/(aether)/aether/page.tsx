import dynamic from "next/dynamic";

/** Aether Vision (`aether-vision`) — hardware / $VISION presale landing. */

const HomePage = dynamic(
  () =>
    import("@/components/HomePage").then((m) => ({
      default: m.HomePage,
    })),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">
        Loading…
      </div>
    ),
  },
);

export default function AetherPage() {
  return <HomePage />;
}
