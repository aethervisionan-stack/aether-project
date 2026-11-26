"use client";

import { useEffect, useId, useRef, useState } from "react";

type SkillHelpTipProps = {
  label: string;
  help: string;
};

/**
 * Tiny “?” affordance next to a skill label. Opens a short gloss on
 * hover, keyboard focus, or tap (mobile).
 */
export function SkillHelpTip({ label, help }: SkillHelpTipProps) {
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex shrink-0 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/80 text-[9px] font-medium leading-none text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300 focus-visible:border-zinc-400 focus-visible:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/60"
        aria-label={`O que significa ${label}`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          setOpen((prev) => !prev);
        }}
      >
        ?
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-20 w-52 -translate-x-1/2 rounded-md border border-zinc-700/90 bg-zinc-950/95 px-2.5 py-1.5 text-left text-[11px] leading-snug text-zinc-300 shadow-lg shadow-black/40 sm:w-56"
        >
          {help}
        </span>
      ) : null}
    </span>
  );
}
