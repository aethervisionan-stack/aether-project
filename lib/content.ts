export const brand = {
  onyx: "#0B0B0C",
  neon: "#00F0FF",
  name: "Aether",
  token: "AETH",
  product: "Aether Lite",
};

export const tokenomics = {
  maxSupply: 1_000_000_000,
  unit: "1 AETH = 1 000 000 uaeth",
  mint: "Supply fixo — sem mint adicional",
  allocations: [
    { label: "Comunidade e mineração", pct: 40, detail: "Emissão e incentivos de rede" },
    { label: "Tesouro do protocolo", pct: 18, detail: "Governação e operações" },
    { label: "Liquidez", pct: 15, detail: "Mercados iniciais AETH" },
    { label: "Equipa", pct: 12, detail: "36 meses, cliff de 12" },
    { label: "Ecossistema Aether Lite", pct: 10, detail: "Onboarding do cliente leve" },
    { label: "Advisors", pct: 5, detail: "24 meses, cliff de 6" },
  ],
} as const;

export const liteFeatures = [
  {
    title: "Sem full node",
    body: "Liga-te à rede com um cliente leve. O Lite trata de chaves, saldo e envio — o resto fica no protocolo.",
  },
  {
    title: "Carteira AETH",
    body: "Cria um endereço, consulta uaeth e envia AETH com taxas transparentes em neon no ecrã.",
  },
  {
    title: "Feito para agentes",
    body: "A mesma conta serve pessoas e bots: limites, memos e recibos no mesmo fluxo do lançamento.",
  },
] as const;

export const utilities = [
  {
    title: "Gás",
    body: "Cada transacção na rede liquida em AETH. O Lite mostra a taxa antes de assinares.",
  },
  {
    title: "Acesso Lite",
    body: "O cliente público usa AETH para quotas de rede, waitlist premium e futuros módulos.",
  },
  {
    title: "Governação",
    body: "Holders votam parâmetros do tesouro e da emissão residual — sem diluição por mint.",
  },
] as const;
