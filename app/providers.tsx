"use client";

import { I18nProvider } from "@/lib/i18n";
import type { ReactNode } from "react";

/** Root providers — quiz landing must not depend on Solana wallet adapters. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
