import type { Metadata } from "next";
import { IqTestApp } from "@/src/components/IqTestApp";

export const metadata: Metadata = {
  title: "Teste de QI Profissional",
  description:
    "Avaliação de inteligência fluida (Gf) com 30 matrizes progressivas em 5 níveis, distratores diagnósticos, QI Wechsler com IC e índice de confiabilidade.",
  robots: { index: false, follow: false },
};

export default function TesteQiPage() {
  return <IqTestApp />;
}
