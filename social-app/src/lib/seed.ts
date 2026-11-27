import { v4 as uuid } from "uuid";
import { avatarDataUrl } from "./avatar";
import type { Database, User } from "./types";
import { todayKey } from "./vip";

export { avatarDataUrl };

function user(partial: Omit<User, "createdAt" | "freeMessagesDate" | "freeMessagesUsed"> & Partial<User>): User {
  return {
    freeMessagesDate: todayKey(),
    freeMessagesUsed: 0,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export const DEBUG_PRESETS = [
  {
    id: "debug-homem-comum",
    label: "Homem Comum",
    description: "Homem verificado, sem VIP, 10 msgs grátis",
  },
  {
    id: "debug-homem-vip",
    label: "Homem VIP avançado",
    description: "Homem VIP6 (gasto R$1.280), créditos e msgs extras",
  },
  {
    id: "debug-mulher-criadora",
    label: "Mulher Criadora",
    description: "Criadora verificada com saldo e histórico",
  },
] as const;

export function buildSeedDatabase(): Database {
  const now = new Date().toISOString();

  const homemComum = user({
    id: "debug-homem-comum",
    name: "Homem Comum",
    age: 28,
    gender: "homem",
    photoUrl: avatarDataUrl("HC", "#2A3A3F"),
    verified: true,
    bio: "Conta de teste — homem sem VIP.",
    credits: 5,
    balanceBrl: 0,
    cumulativeSpendBrl: 0,
    cumulativeEarningsBrl: 0,
    isSeed: true,
    isDebugPreset: true,
  });

  const homemVip = user({
    id: "debug-homem-vip",
    name: "Homem VIP avançado",
    age: 32,
    gender: "homem",
    photoUrl: avatarDataUrl("HV", "#8B5A2B"),
    verified: true,
    bio: "Conta de teste — VIP6 por gasto acumulado.",
    credits: 40,
    balanceBrl: 0,
    cumulativeSpendBrl: 1280,
    cumulativeEarningsBrl: 0,
    isSeed: true,
    isDebugPreset: true,
  });

  const mulherCriadora = user({
    id: "debug-mulher-criadora",
    name: "Mulher Criadora",
    age: 26,
    gender: "mulher",
    photoUrl: avatarDataUrl("MC", "#6B3A3A"),
    verified: true,
    bio: "Criadora de teste — painel de ganhos e saque Pix.",
    credits: 0,
    balanceBrl: 48.4,
    cumulativeSpendBrl: 0,
    cumulativeEarningsBrl: 520,
    isSeed: true,
    isDebugPreset: true,
  });

  const femaleProfiles: User[] = [
    user({
      id: "seed-f-1",
      name: "Larissa",
      age: 24,
      gender: "mulher",
      photoUrl: avatarDataUrl("LA", "#A65D4A"),
      verified: true,
      bio: "Adoro café e conversas longas à noite.",
      credits: 0,
      balanceBrl: 12.6,
      cumulativeSpendBrl: 0,
      cumulativeEarningsBrl: 210,
      isSeed: true,
    }),
    user({
      id: "seed-f-2",
      name: "Beatriz",
      age: 27,
      gender: "mulher",
      photoUrl: avatarDataUrl("BE", "#3D6B5A"),
      verified: true,
      bio: "Fotógrafa amadora. Verificada e sempre online.",
      credits: 0,
      balanceBrl: 8.2,
      cumulativeSpendBrl: 0,
      cumulativeEarningsBrl: 180,
      isSeed: true,
    }),
    user({
      id: "seed-f-3",
      name: "Camila",
      age: 23,
      gender: "mulher",
      photoUrl: avatarDataUrl("CA", "#4A5578"),
      verified: true,
      bio: "Música, viagem e bom humor.",
      credits: 0,
      balanceBrl: 22.0,
      cumulativeSpendBrl: 0,
      cumulativeEarningsBrl: 640,
      isSeed: true,
    }),
    user({
      id: "seed-f-4",
      name: "Helena",
      age: 29,
      gender: "mulher",
      photoUrl: avatarDataUrl("HE", "#6A4A6B"),
      verified: true,
      bio: "Criadora ativa — adoro conhecer gente nova.",
      credits: 0,
      balanceBrl: 35.4,
      cumulativeSpendBrl: 0,
      cumulativeEarningsBrl: 1100,
      isSeed: true,
    }),
    user({
      id: "seed-f-5",
      name: "Isabela",
      age: 25,
      gender: "mulher",
      photoUrl: avatarDataUrl("IS", "#7A5A2A"),
      verified: true,
      bio: "Fitness e lifestyle. Respondo rápido.",
      credits: 0,
      balanceBrl: 5.0,
      cumulativeSpendBrl: 0,
      cumulativeEarningsBrl: 95,
      isSeed: true,
    }),
    user({
      id: "seed-f-6",
      name: "Marina",
      age: 31,
      gender: "mulher",
      photoUrl: avatarDataUrl("MA", "#2F4F5A"),
      verified: true,
      bio: "Conversas profundas > small talk.",
      credits: 0,
      balanceBrl: 18.8,
      cumulativeSpendBrl: 0,
      cumulativeEarningsBrl: 420,
      isSeed: true,
    }),
  ];

  const users: User[] = [homemComum, homemVip, mulherCriadora, ...femaleProfiles];

  const convId = "seed-conv-1";
  const conversations = [
    {
      id: convId,
      participantIds: [homemComum.id, mulherCriadora.id] as [string, string],
      updatedAt: now,
      lastMessagePreview: "Oi! Bem-vindo ao protótipo 👋",
    },
    {
      id: "seed-conv-2",
      participantIds: [homemVip.id, femaleProfiles[0].id] as [string, string],
      updatedAt: now,
      lastMessagePreview: "E aí, tudo bem?",
    },
  ];

  const messages = [
    {
      id: uuid(),
      conversationId: convId,
      fromUserId: mulherCriadora.id,
      toUserId: homemComum.id,
      text: "Oi! Bem-vindo ao protótipo 👋 Aqui o Pix e a verificação facial são simulados.",
      createdAt: now,
      paid: false,
      platformShareBrl: 0,
      creatorShareBrl: 0,
    },
    {
      id: uuid(),
      conversationId: "seed-conv-2",
      fromUserId: femaleProfiles[0].id,
      toUserId: homemVip.id,
      text: "E aí, tudo bem? Sou a Larissa — perfil seed verificado.",
      createdAt: now,
      paid: false,
      platformShareBrl: 0,
      creatorShareBrl: 0,
    },
  ];

  return {
    users,
    conversations,
    messages,
    purchases: [
      {
        id: uuid(),
        userId: homemVip.id,
        credits: 3200,
        amountBrl: 1280,
        packLabel: "Simulação seed VIP6",
        createdAt: now,
        simulatedPix: true,
      },
    ],
    withdrawals: [
      {
        id: uuid(),
        userId: mulherCriadora.id,
        amountBrl: 20,
        createdAt: now,
        method: "pix",
        simulated: true,
        note: "Saque seed do dia (simulado)",
      },
    ],
    ledger: [
      {
        id: uuid(),
        userId: homemVip.id,
        type: "credit_purchase",
        amountBrl: 1280,
        creditsDelta: 3200,
        description: "Compra seed — gasto acumulado VIP6",
        createdAt: now,
      },
      {
        id: uuid(),
        userId: mulherCriadora.id,
        type: "creator_earning",
        amountBrl: 520,
        creditsDelta: 0,
        description: "Ganhos acumulados seed (VIP2)",
        createdAt: now,
      },
      {
        id: uuid(),
        userId: mulherCriadora.id,
        type: "vip_bonus",
        amountBrl: 50,
        creditsDelta: 0,
        description: "Bônus VIP2 — Destaque na busca (+R$50)",
        createdAt: now,
      },
      {
        id: uuid(),
        userId: mulherCriadora.id,
        type: "withdrawal",
        amountBrl: -20,
        creditsDelta: 0,
        description: "Saque Pix simulado (seed)",
        createdAt: now,
      },
    ],
    initializedAt: now,
  };
}
