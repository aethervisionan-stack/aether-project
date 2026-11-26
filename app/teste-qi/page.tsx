import type { Metadata } from "next";
import { IqTestApp } from "@/src/components/IqTestApp";

export const metadata: Metadata = {
  title: "Teste de QI Profissional",
  description:
    "Avaliação de inteligência fluida (Gf) com matrizes progressivas estilo Raven/Mensa — 25 questões, SVG procedural, estimativa Wechsler.",
  robots: { index: false, follow: false },
};

export default function TesteQiPage() {
  return <IqTestApp />;
}
