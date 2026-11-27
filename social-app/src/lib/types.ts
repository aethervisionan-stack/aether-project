export type Gender = "homem" | "mulher";

export type User = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  photoUrl: string;
  verified: boolean;
  bio: string;
  /** Credits balance (men) */
  credits: number;
  /** Available Pix balance in BRL (creators) */
  balanceBrl: number;
  /** Cumulative spend on credit packs (men) — drives male VIP */
  cumulativeSpendBrl: number;
  /** Cumulative earnings from paid messages (creators) — drives female VIP */
  cumulativeEarningsBrl: number;
  /** Free messages used today (YYYY-MM-DD keyed) */
  freeMessagesDate: string;
  freeMessagesUsed: number;
  isSeed: boolean;
  isDebugPreset?: boolean;
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
  /** true if this message consumed a paid credit */
  paid: boolean;
  platformShareBrl: number;
  creatorShareBrl: number;
};

export type Conversation = {
  id: string;
  participantIds: [string, string];
  updatedAt: string;
  lastMessagePreview: string;
};

export type CreditPurchase = {
  id: string;
  userId: string;
  credits: number;
  amountBrl: number;
  packLabel: string;
  createdAt: string;
  simulatedPix: true;
};

export type Withdrawal = {
  id: string;
  userId: string;
  amountBrl: number;
  createdAt: string;
  method: "pix";
  simulated: true;
  note: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  type:
    | "credit_purchase"
    | "message_spend"
    | "creator_earning"
    | "platform_fee"
    | "withdrawal"
    | "vip_bonus";
  amountBrl: number;
  creditsDelta: number;
  description: string;
  relatedMessageId?: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  conversations: Conversation[];
  messages: Message[];
  purchases: CreditPurchase[];
  withdrawals: Withdrawal[];
  ledger: LedgerEntry[];
  initializedAt: string;
};

export type SessionPayload = {
  userId: string;
};
