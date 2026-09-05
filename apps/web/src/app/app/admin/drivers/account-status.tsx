"use client";

import { Badge } from "@/components/ui/badge";
import type { DriverPayMethod, DriverReviewStatus } from "@/lib/demo-store";
import type { Dictionary } from "@/lib/i18n/en";

export function reviewStatusLabel(status: DriverReviewStatus, dict: Dictionary) {
  if (status === "paid") return dict.admin.statusPaid;
  if (status === "grace") return dict.admin.statusGrace;
  if (status === "frozen") return dict.admin.statusFrozen;
  if (status === "banned") return dict.admin.statusBanned;
  return dict.admin.statusUnpaid;
}

export function payMethodLabel(method: DriverPayMethod, dict: Dictionary) {
  if (method === "whish") return dict.admin.payWhish;
  if (method === "whish_manual") return dict.admin.payWhishManual;
  return dict.admin.payNone;
}

export function ReviewStatusBadge({
  status,
  dict,
}: {
  status: DriverReviewStatus;
  dict: Dictionary;
}) {
  const variant =
    status === "banned"
      ? "destructive"
      : status === "frozen" || status === "unpaid"
        ? "outline"
        : status === "grace"
          ? "secondary"
          : "default";
  return (
    <Badge variant={variant} className="capitalize">
      {reviewStatusLabel(status, dict)}
    </Badge>
  );
}
