import type { User } from "./types";
import { freeMessagesAllowance, getFemaleVip, getMaleVip, todayKey } from "./vip";

export function publicUser(u: User) {
  const maleVip = getMaleVip(u.cumulativeSpendBrl);
  const femaleVip = getFemaleVip(u.cumulativeEarningsBrl);
  const allowance = freeMessagesAllowance(u.cumulativeSpendBrl);
  const used =
    u.freeMessagesDate === todayKey() ? u.freeMessagesUsed : 0;
  const remaining =
    allowance === "unlimited"
      ? ("unlimited" as const)
      : Math.max(0, allowance - used);

  return {
    ...u,
    maleVip,
    femaleVip,
    freeMessages: {
      allowance,
      used,
      remaining,
      date: todayKey(),
    },
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
