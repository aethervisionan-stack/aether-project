"use client";

import { useEffect, useState } from "react";

export function CursorGlow() {
  const [pos, setPos] = useState({ x: 50, y: 18 });

  useEffect(() => {
    const media = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!media.matches || reduce.matches) return;

    const onMove = (event: PointerEvent) => {
      setPos({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 hidden md:block"
      style={{
        background: `radial-gradient(540px circle at ${pos.x}% ${pos.y}%, rgba(6,182,212,0.09), transparent 42%)`,
      }}
    />
  );
}
