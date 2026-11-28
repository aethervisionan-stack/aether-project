"use client";

import { useEffect } from "react";

type Props = {
  photoUrl: string;
  watermark: string;
  onClose: () => void;
};

export function ViewOnceModal({ photoUrl, watermark, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-4"
      role="dialog"
      aria-modal
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 text-sm text-[#f0d2b0]">
        <p>Visualização única — ao fechar a foto expira</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
        >
          Fechar
        </button>
      </div>

      <div
        className="relative max-h-[80vh] max-w-[min(92vw,420px)] select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="Foto view once"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="max-h-[80vh] w-full rounded-2xl object-contain pointer-events-none"
          style={{ WebkitUserSelect: "none", userSelect: "none" }}
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <p className="absolute left-3 top-3 rotate-[-12deg] text-[11px] font-medium tracking-wide text-white/35">
            {watermark}
          </p>
          <p className="absolute bottom-8 right-4 rotate-[-8deg] text-[11px] text-white/30">
            {watermark}
          </p>
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] text-sm text-white/20">
            {watermark}
          </p>
        </div>
      </div>

      <p className="absolute inset-x-4 bottom-4 text-center text-[11px] text-white/50">
        Proteções web: sem clique direito / arrastar. Em app nativo: bloquear screenshots + URL
        assinada temporária.
      </p>
    </div>
  );
}
