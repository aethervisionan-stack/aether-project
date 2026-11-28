import { FEMALE_VIP, formatBrl } from "./vip";
import type { Database, LedgerEntry, Message, User } from "./types";
import { v4 as uuid } from "uuid";

export const CREDIT_PRICE_BRL = 0.4;
export const MSG_CREATOR_SHARE_BRL = 0.2;
export const MSG_PLATFORM_SHARE_BRL = 0.2;
export const PHOTO_CREDITS_COST = 5;
export const PHOTO_PRICE_BRL = 2.0;
export const PHOTO_CREATOR_SHARE_BRL = 1.0;
export const PHOTO_PLATFORM_SHARE_BRL = 1.0;
export const FREE_PHOTOS = 3;

export const DEFAULT_SETTINGS = {
  freePhotoScope: "per_conversation" as const,
  includeHourPayInVip: false,
  defaultHourlyRateBrl: 10,
  activityTargetMinutesPerHour: 50,
};

export function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join("__");
}

/**
 * Count photos already counting toward the free quota.
 * - per_conversation: photos from this creator → male in this conversation
 * - per_male_user: all photos received by this male (any creator)
 */
export function countPhotosInScope(
  db: Database,
  creatorId: string,
  maleId: string,
  conversationId: string
): number {
  const scope = db.settings?.freePhotoScope ?? "per_conversation";
  return db.messages.filter((m) => {
    if (m.kind !== "photo") return false;
    if (m.toUserId !== maleId) return false;
    if (scope === "per_male_user") return true;
    return m.fromUserId === creatorId && m.conversationId === conversationId;
  }).length;
}

export function grantFemaleVipBonuses(
  db: Database,
  user: User,
  prevEarnings: number,
  newEarnings: number,
  now: string
) {
  const prevLevel =
    FEMALE_VIP.filter((l) => prevEarnings >= l.minEarningsBrl).pop()?.level ?? 0;
  const newLevel =
    FEMALE_VIP.filter((l) => newEarnings >= l.minEarningsBrl).pop()?.level ?? 0;
  if (newLevel <= prevLevel) return;
  for (const lvl of FEMALE_VIP) {
    if (lvl.level > prevLevel && lvl.level <= newLevel) {
      user.balanceBrl = Number((user.balanceBrl + lvl.bonusBrl).toFixed(2));
      db.ledger.push({
        id: uuid(),
        userId: user.id,
        type: "vip_bonus",
        amountBrl: lvl.bonusBrl,
        creditsDelta: 0,
        description: `Bônus VIP Feminino VIP${lvl.level} — ${lvl.title} (+${formatBrl(lvl.bonusBrl)})`,
        createdAt: now,
      });
    }
  }
}

export function creditCreatorCommission(
  db: Database,
  creator: User,
  amountBrl: number,
  now: string,
  opts: {
    type: "creator_message" | "creator_photo";
    description: string;
    relatedMessageId?: string;
    forVip?: boolean;
  }
) {
  const forVip = opts.forVip !== false;
  creator.balanceBrl = Number((creator.balanceBrl + amountBrl).toFixed(2));
  if (forVip) {
    const prev = creator.cumulativeEarningsBrl;
    creator.cumulativeEarningsBrl = Number(
      (creator.cumulativeEarningsBrl + amountBrl).toFixed(2)
    );
    grantFemaleVipBonuses(db, creator, prev, creator.cumulativeEarningsBrl, now);
  }
  db.ledger.push({
    id: uuid(),
    userId: creator.id,
    type: opts.type,
    amountBrl,
    creditsDelta: 0,
    description: opts.description,
    relatedMessageId: opts.relatedMessageId,
    createdAt: now,
  });
}

export function creditOnlineHour(
  db: Database,
  creator: User,
  minutes: number,
  now: string
) {
  const hours = minutes / 60;
  const amount = Number((hours * creator.hourlyRateBrl).toFixed(2));
  if (amount <= 0) return { amount: 0 };

  creator.balanceBrl = Number((creator.balanceBrl + amount).toFixed(2));
  creator.cumulativeHourPayBrl = Number(
    (creator.cumulativeHourPayBrl + amount).toFixed(2)
  );

  if (db.settings.includeHourPayInVip) {
    const prev = creator.cumulativeEarningsBrl;
    creator.cumulativeEarningsBrl = Number(
      (creator.cumulativeEarningsBrl + amount).toFixed(2)
    );
    grantFemaleVipBonuses(db, creator, prev, creator.cumulativeEarningsBrl, now);
  }

  db.ledger.push({
    id: uuid(),
    userId: creator.id,
    type: "creator_online_hour",
    amountBrl: amount,
    creditsDelta: 0,
    description: `Hora Online Remunerada — ${minutes} min × ${formatBrl(creator.hourlyRateBrl)}/h`,
    createdAt: now,
  });
  db.ledger.push({
    id: uuid(),
    userId: "platform",
    type: "platform_hour_commit",
    amountBrl: amount,
    creditsDelta: 0,
    description: `Compromisso hora online — ${creator.name} (${minutes} min)`,
    createdAt: now,
  });

  return { amount };
}

export function ensureConversation(
  db: Database,
  a: string,
  b: string,
  preview: string,
  now: string
) {
  const cid = conversationIdFor(a, b);
  let conv = db.conversations.find((c) => c.id === cid);
  if (!conv) {
    conv = {
      id: cid,
      participantIds: [a, b],
      updatedAt: now,
      lastMessagePreview: preview.slice(0, 80),
    };
    db.conversations.push(conv);
  } else {
    conv.updatedAt = now;
    conv.lastMessagePreview = preview.slice(0, 80);
  }
  return conv;
}

export function platformSummary(db: Database) {
  const sum = (type: LedgerEntry["type"]) =>
    db.ledger
      .filter((e) => e.userId === "platform" && e.type === type)
      .reduce((acc, e) => acc + e.amountBrl, 0);

  const msgFees = sum("platform_fee");
  const photoFees = sum("platform_photo_fee");
  const hourCommit = sum("platform_hour_commit");
  const withdrawals = db.withdrawals.reduce((acc, w) => acc + w.amountBrl, 0);

  return {
    paidMessagesPlatformBrl: Number(msgFees.toFixed(2)),
    paidPhotosPlatformBrl: Number(photoFees.toFixed(2)),
    hourPayCommittedBrl: Number(hourCommit.toFixed(2)),
    withdrawalsBrl: Number(withdrawals.toFixed(2)),
    settings: db.settings,
  };
}

export function serializePhotoForViewer(
  m: Message,
  viewerId: string
): Message {
  if (m.kind !== "photo") return m;
  const isSender = m.fromUserId === viewerId;
  const unlocked = Boolean(m.photoUnlocked) || isSender;
  const expired = m.photoViewStatus === "expired_viewed";

  // Never send raw URL to locked/expired viewers (except sender keeps preview)
  if (!isSender && (!unlocked || expired)) {
    return {
      ...m,
      photoUrl: undefined,
      text: expired
        ? "Visualização única encerrada — foto expirada"
        : m.photoFree
          ? "Foto grátis — visualização única"
          : "Foto bloqueada",
    };
  }
  return m;
}
