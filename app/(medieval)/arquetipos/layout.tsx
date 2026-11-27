import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Arquétipo — Descubra o arquétipo que guia sua essência",
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default function ArquetiposLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
