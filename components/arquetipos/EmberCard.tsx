"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Visual-only ember card chrome — glow, border, sparks.
 * No hover SFX (audio stays on explicit journey / quiz actions).
 */
export function EmberCard({ children, className = "" }: Props) {
  return (
    <div className="ember-card relative h-full overflow-hidden rounded-sm">
      <span className="ember-card-glow" aria-hidden />
      <span className="ember-card-border" aria-hidden />
      <span className="ember-sparks" aria-hidden>
        <i className="ember-spark ember-spark-1" />
        <i className="ember-spark ember-spark-2" />
        <i className="ember-spark ember-spark-3" />
        <i className="ember-spark ember-spark-4" />
        <i className="ember-spark ember-spark-5" />
        <i className="ember-spark ember-spark-6" />
      </span>
      <div className={`relative z-[1] h-full ${className}`}>{children}</div>
    </div>
  );
}
