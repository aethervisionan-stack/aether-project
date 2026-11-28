export type MaleVipLevel = {
  level: number;
  minSpendBrl: number;
  freeMessagesPerDay: number | "unlimited";
  videoMinutes: number | "unlimited";
  label: string;
};

export type FemaleVipLevel = {
  level: number;
  minEarningsBrl: number;
  bonusBrl: number;
  title: string;
  perks: string[];
};

/** Male VIP — cumulative credit spend */
export const MALE_VIP: MaleVipLevel[] = [
  { level: 1, minSpendBrl: 40, freeMessagesPerDay: 20, videoMinutes: 5, label: "VIP1" },
  { level: 2, minSpendBrl: 80, freeMessagesPerDay: 30, videoMinutes: 5, label: "VIP2" },
  { level: 3, minSpendBrl: 160, freeMessagesPerDay: 40, videoMinutes: 5, label: "VIP3" },
  { level: 4, minSpendBrl: 320, freeMessagesPerDay: 50, videoMinutes: 5, label: "VIP4" },
  { level: 5, minSpendBrl: 640, freeMessagesPerDay: 60, videoMinutes: 5, label: "VIP5" },
  { level: 6, minSpendBrl: 1280, freeMessagesPerDay: 70, videoMinutes: 5, label: "VIP6" },
  { level: 7, minSpendBrl: 2560, freeMessagesPerDay: 80, videoMinutes: 5, label: "VIP7" },
  { level: 8, minSpendBrl: 3120, freeMessagesPerDay: 90, videoMinutes: 5, label: "VIP8" },
  { level: 9, minSpendBrl: 6240, freeMessagesPerDay: 100, videoMinutes: 5, label: "VIP9" },
  {
    level: 10,
    minSpendBrl: 12480,
    freeMessagesPerDay: "unlimited",
    videoMinutes: "unlimited",
    label: "VIP10",
  },
  {
    level: 11,
    minSpendBrl: 24860,
    freeMessagesPerDay: "unlimited",
    videoMinutes: "unlimited",
    label: "VIP11",
  },
  {
    level: 12,
    minSpendBrl: 50000,
    freeMessagesPerDay: "unlimited",
    videoMinutes: "unlimited",
    label: "VIP12",
  },
];

/** Female VIP — cumulative earnings (R$0.20 per paid message) */
export const FEMALE_VIP: FemaleVipLevel[] = [
  {
    level: 1,
    minEarningsBrl: 200,
    bonusBrl: 20,
    title: "Criadora Ativa",
    perks: ["Prioridade leve no feed"],
  },
  {
    level: 2,
    minEarningsBrl: 500,
    bonusBrl: 50,
    title: "Destaque na busca",
    perks: ["Destaque na busca", "Saque instantâneo"],
  },
  {
    level: 3,
    minEarningsBrl: 1000,
    bonusBrl: 100,
    title: "Top Conversa",
    perks: ["Prioridade média"],
  },
  {
    level: 4,
    minEarningsBrl: 2000,
    bonusBrl: 200,
    title: "Horário de pico",
    perks: ["Prioridade em horário de pico"],
  },
  {
    level: 5,
    minEarningsBrl: 4000,
    bonusBrl: 400,
    title: "Destaque VIP",
    perks: ["Bônus de vídeo"],
  },
  {
    level: 6,
    minEarningsBrl: 8000,
    bonusBrl: 800,
    title: "Alta prioridade",
    perks: ["Alta prioridade", "Suporte prioritário"],
  },
  {
    level: 7,
    minEarningsBrl: 15000,
    bonusBrl: 1500,
    title: "Elite",
    perks: ["Destaque para homens VIP"],
  },
  {
    level: 8,
    minEarningsBrl: 25000,
    bonusBrl: 2500,
    title: "Badge exclusiva",
    perks: ["Limite diário de saque maior", "Badge exclusiva"],
  },
  {
    level: 9,
    minEarningsBrl: 40000,
    bonusBrl: 4000,
    title: "Máximo no feed",
    perks: ["Máximo no feed", "Campanhas"],
  },
  {
    level: 10,
    minEarningsBrl: 65000,
    bonusBrl: 7000,
    title: "Embaixadora",
    perks: ["Taxa de saque zero"],
  },
  {
    level: 11,
    minEarningsBrl: 100000,
    bonusBrl: 12000,
    title: "Topo fixo",
    perks: ["Topo fixo", "Retenção mensal"],
  },
  {
    level: 12,
    minEarningsBrl: 160000,
    bonusBrl: 20000,
    title: "Lenda da Rede",
    perks: ["Parceria especial"],
  },
];

export const BASE_FREE_MESSAGES = 10;
export {
  CREDIT_PRICE_BRL,
  MSG_CREATOR_SHARE_BRL as CREATOR_SHARE_BRL,
  MSG_PLATFORM_SHARE_BRL as PLATFORM_SHARE_BRL,
  PHOTO_CREDITS_COST,
  PHOTO_PRICE_BRL,
  PHOTO_CREATOR_SHARE_BRL,
  PHOTO_PLATFORM_SHARE_BRL,
  FREE_PHOTOS,
} from "./economy";

export function getMaleVip(spendBrl: number) {
  let current: MaleVipLevel | null = null;
  for (const lvl of MALE_VIP) {
    if (spendBrl >= lvl.minSpendBrl) current = lvl;
  }
  const next = current
    ? MALE_VIP.find((l) => l.level === current!.level + 1) ?? null
    : MALE_VIP[0];
  const prevMin = current?.minSpendBrl ?? 0;
  const nextMin = next?.minSpendBrl ?? current?.minSpendBrl ?? 0;
  const progress =
    !next || nextMin === prevMin
      ? 1
      : Math.min(1, Math.max(0, (spendBrl - prevMin) / (nextMin - prevMin)));

  return { current, next, progress, spendBrl };
}

export function getFemaleVip(earningsBrl: number) {
  let current: FemaleVipLevel | null = null;
  for (const lvl of FEMALE_VIP) {
    if (earningsBrl >= lvl.minEarningsBrl) current = lvl;
  }
  const next = current
    ? FEMALE_VIP.find((l) => l.level === current!.level + 1) ?? null
    : FEMALE_VIP[0];
  const prevMin = current?.minEarningsBrl ?? 0;
  const nextMin = next?.minEarningsBrl ?? current?.minEarningsBrl ?? 0;
  const progress =
    !next || nextMin === prevMin
      ? 1
      : Math.min(1, Math.max(0, (earningsBrl - prevMin) / (nextMin - prevMin)));

  return { current, next, progress, earningsBrl };
}

export function freeMessagesAllowance(spendBrl: number): number | "unlimited" {
  const { current } = getMaleVip(spendBrl);
  if (!current) return BASE_FREE_MESSAGES;
  if (current.freeMessagesPerDay === "unlimited") return "unlimited";
  return BASE_FREE_MESSAGES + current.freeMessagesPerDay;
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
