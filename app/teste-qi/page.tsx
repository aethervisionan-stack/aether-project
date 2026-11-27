import type { Metadata } from "next";
import { IqTestApp } from "@/src/components/IqTestApp";

/** TestLineQi (`testlineqi`) — IQ assessment at `/teste-qi`. Do not break payment/IA/logo. */

export const metadata: Metadata = {
  title: "Teste de QI Profissional",
  description:
    "Avaliação cognitiva digital de raciocínio abstrato-lógico (média 100, DP 15), com intervalo de confiança, percentil em linguagem clara e aviso: não substitui avaliação neuropsicológica presencial.",
  robots: { index: false, follow: false },
};

export default function TesteQiPage() {
  return <IqTestApp />;
}
