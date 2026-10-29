import { SITE_NAME } from "@/lib/site";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid-aether relative flex min-h-[70vh] items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This route does not exist on {SITE_NAME}. Return to the presale
          landing.
        </p>
        <Link
          href="/"
          className="glow-cta mt-8 inline-flex rounded-full bg-gradient-to-r from-cyan to-neon px-6 py-3 text-sm font-medium text-onyx"
        >
          Back to Aether Vision
        </Link>
      </div>
    </main>
  );
}
