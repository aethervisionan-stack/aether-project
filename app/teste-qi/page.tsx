import type { Metadata } from "next";
import { IqTestApp } from "@/src/components/IqTestApp";

export const metadata: Metadata = {
  title: "Teste de QI Profissional",
  description:
    "Avaliação multimodo: figuras geométricas, perguntas objetivas ou híbrido — 30 itens, 5 níveis, QI Wechsler (média 100, DP 15) com IC e diagnóstico de precisão.",
  robots: { index: false, follow: false },
};

export default function TesteQiPage() {
  return <IqTestApp />;
}
