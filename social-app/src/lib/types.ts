export type Gender = "homem" | "mulher";

export type ShiftStatus = "offline" | "active" | "paused";

export type FreePhotoScope = "per_conversation" | "per_male_user";

export type PhotoViewStatus = "locked" | "available" | "expired_viewed";

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
  /**
   * Commission earnings for female VIP (msgs + photos + interaction bonuses).
   * Hour pay is excluded unless settings.includeHourPayInVip.
   */
  cumulativeEarningsBrl: number;
  /** Cumulative validated hour pay (always tracked; VIP only if toggle on) */
  cumulativeHourPayBrl: number;
  /** Free messages used today (YYYY-MM-DD keyed) */
  freeMessagesDate: string;
  freeMessagesUsed: number;
  /** Free photos used when scope = per_male_user */
  freePhotosUsed: number;
  /** Creator online-hour module */
  hourlyRateBrl: number;
  shiftStatus: ShiftStatus;
  onlineMinutesToday: number;
  onlineMinutesDate: string;
  shiftStartedAt: string | null;
  activityScore: number;
  isSeed: boolean;
  isDebugPreset?: boolean;
  createdAt: string;
};

export type MessageKind = "text" | "photo";

export type Message = {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  kind: MessageKind;
  createdAt: string;
  /** true if this text message consumed a paid credit */
  paid: boolean;
  platformShareBrl: number;
  creatorShareBrl: number;
  /** Photo fields (kind === "photo") */
  photoUrl?: string;
  photoIndex?: number;
  photoFree?: boolean;
  photoCreditsCost?: number;
  photoUnlocked?: boolean;
  photoViewStatus?: PhotoViewStatus;
  photoViewedAt?: string | null;
  photoUnlockedAt?: string | null;
  photoUnlockedBy?: string | null;
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

export type LedgerType =
  | "credit_purchase"
  | "message_spend"
  | "photo_spend"
  | "creator_message"
  | "creator_photo"
  | "creator_online_hour"
  | "platform_fee"
  | "platform_photo_fee"
  | "platform_hour_commit"
  | "withdrawal"
  | "vip_bonus"
  /** legacy seed compatibility */
  | "creator_earning";

export type LedgerEntry = {
  id: string;
  userId: string;
  type: LedgerType;
  amountBrl: number;
  creditsDelta: number;
  description: string;
  relatedMessageId?: string;
  createdAt: string;
};

export type AppSettings = {
  freePhotoScope: FreePhotoScope;
  /** When true, hour pay counts toward female VIP cumulativeEarningsBrl */
  includeHourPayInVip: boolean;
  defaultHourlyRateBrl: number;
  /** Activity target minutes per paid hour (indicator only in early phase) */
  activityTargetMinutesPerHour: number;
};

export type Database = {
  users: User[];
  conversations: Conversation[];
  messages: Message[];
  purchases: CreditPurchase[];
  withdrawals: Withdrawal[];
  ledger: LedgerEntry[];
  settings: AppSettings;
  initializedAt: string;
};

export type SessionPayload = {
  userId: string;
};
