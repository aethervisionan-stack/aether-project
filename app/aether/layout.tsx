import type { Metadata } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { AetherProviders } from "./providers";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/aether" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/aether`,
    siteName: SITE_NAME,
  },
};

export default function AetherLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AetherProviders>{children}</AetherProviders>;
}
