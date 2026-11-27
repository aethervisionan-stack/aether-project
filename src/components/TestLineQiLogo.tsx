"use client";

import Image from "next/image";
import { LivingBrainLogo } from "@/src/components/LivingBrainLogo";

type Variant = "full" | "icon" | "living";

const SRC = {
  full: "/testlineqi-brain-logo.png",
  icon: "/logo-tiktok-perfil.png",
} as const;

export function TestLineQiLogo({
  variant = "living",
  className = "",
  priority = false,
  href = "/teste-qi",
}: {
  variant?: Variant;
  className?: string;
  priority?: boolean;
  href?: string | null;
}) {
  if (variant === "living") {
    return (
      <LivingBrainLogo
        size="sm"
        showWordmark
        href={href}
        className={className}
        animate
      />
    );
  }

  const img =
    variant === "icon" ? (
      <Image
        src={SRC.icon}
        alt="TestLineQi"
        width={40}
        height={40}
        priority={priority}
        className={`h-8 w-8 rounded-lg object-cover sm:h-9 sm:w-9 ${className}`}
      />
    ) : (
      <Image
        src={SRC.full}
        alt="TestLineQi"
        width={220}
        height={124}
        priority={priority}
        className={`h-8 w-auto max-w-[min(52vw,11.5rem)] object-contain object-left sm:h-9 sm:max-w-[13.5rem] ${className}`}
      />
    );

  if (!href) return img;

  return (
    <a
      href={href}
      className="inline-flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070A]"
      aria-label="TestLineQi"
    >
      {img}
    </a>
  );
}

export function TestLineQiFooter({
  className = "",
}: {
  className?: string;
}) {
  return (
    <footer
      className={`mt-10 border-t border-white/[0.08] pt-8 ${className}`}
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <LivingBrainLogo href="/teste-qi" size="sm" />
        <p className="max-w-md text-xs leading-relaxed text-zinc-500">
          TestLineQi — avaliação cognitiva digital com rigor metodológico e
          leitura clara do seu perfil.
        </p>
      </div>
    </footer>
  );
}
