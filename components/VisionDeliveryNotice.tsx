"use client";

import { Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type VisionDeliveryNoticeProps = {
  className?: string;
  tone?: "checkout" | "success";
};

export function VisionDeliveryNotice({
  className = "",
  tone = "checkout",
}: VisionDeliveryNoticeProps) {
  const { t } = useI18n();
  const text =
    tone === "success" ? t.receipt.deliveryNotice : t.checkout.deliveryNotice;

  return (
    <div
      role="note"
      className={`flex gap-3 rounded-2xl border border-cyan/20 bg-cyan/[0.06] px-3.5 py-3 ${className}`}
    >
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/10 text-cyan">
        <Info size={13} aria-hidden />
      </span>
      <p className="text-[12px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}
