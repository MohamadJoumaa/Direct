/**
 * Shared driver payment rules for web and future Expo (`apps/mobile`).
 *
 * Product contract (do not weaken on any client):
 * - Unlock ONLY when Whish `collectStatus === "success"` (exact string).
 * - Opening the pay URL, leaving without paying, pending, failed, or unknown
 *   MUST NOT unlock.
 * - Callback / redirect query params MUST NOT unlock. Always re-verify
 *   `POST /payment/collect/status` by `externalId`.
 * - Company Whish number (`WHISH_NUMBER`) is contact only — never payment proof.
 * - When `WHISH_CHANNEL` / `WHISH_SECRET` are missing, the fallback is
 *   driver “I already paid” + admin Confirm.
 *
 * Percentage settle: previous Beirut work day (07:00→07:00 Asia/Beirut)
 * company cuts become `dueNow` at the next 07:00 boundary. Today’s cuts
 * stay accruing until that boundary. No cron required — evaluate on every
 * claim / go-online / payment check.
 *
 * See `packages/shared/src/payment-rules.md`.
 */

/** Exact Whish collect status that unlocks a driver. Never treat other casings. */
export const WHISH_COLLECT_SUCCESS_STATUS = "success" as const;

/** Whish collect amounts are USD. */
export const WHISH_COLLECT_CURRENCY = "USD" as const;

/** Merchant collect create path (relative to `WHISH_BASE_URL`). */
export const WHISH_COLLECT_CREATE_PATH = "/payment/whish" as const;

/** Status poll path — the only source of truth for unlock. */
export const WHISH_COLLECT_STATUS_PATH = "/payment/collect/status" as const;

/**
 * Cap for a single collect request. High enough for subscription + freeze
 * penalty and a day’s commission backlog.
 */
export const WHISH_MAX_AMOUNT_USD = 10_000;

/** Keys to read a pay URL from a Whish create response (root or `data`). */
export const WHISH_COLLECT_PAY_URL_KEYS = [
  "collectUrl",
  "whishUrl",
  "url",
  "paymentUrl",
  "payUrl",
] as const;

export type WhishCollectKind = "subscription" | "commission";

/**
 * True only for the exact collect success string. Opening a URL, a redirect,
 * or any other status must stay unpaid.
 */
export function isWhishCollectPaid(collectStatus: unknown): boolean {
  return collectStatus === WHISH_COLLECT_SUCCESS_STATUS;
}

/** Parse a collect amount; reject non-finite, non-positive, or over the cap. */
export function parseCollectAmountUsd(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > WHISH_MAX_AMOUNT_USD) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

/** First https URL among known collect response keys. */
export function extractCollectPayUrl(payload: unknown): string | null {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const data =
    root?.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  if (!data) return null;
  for (const key of WHISH_COLLECT_PAY_URL_KEYS) {
    const value = data[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

/**
 * Split a completed order’s company cut across the current Beirut work-day
 * start. `workDayStartMs` must be `workDayStart(at).getTime()` from this
 * package so web and mobile share the 07:00 Asia/Beirut boundary.
 *
 * - `due` — completed before this work-day start (previous day + unpaid backlog)
 * - `accruing` — completed on/after this work-day start (not payable yet)
 */
export function classifyCommissionCut(
  completedAtMs: number,
  workDayStartMs: number,
): "due" | "accruing" {
  return completedAtMs < workDayStartMs ? "due" : "accruing";
}

/** Payable commission after subtracting confirmed `kind: "commission"` payments. */
export function commissionDueNowUsd(
  dueCutsUsd: number,
  confirmedCommissionPaidUsd: number,
): number {
  return Math.round(Math.max(0, dueCutsUsd - confirmedCommissionPaidUsd) * 100) / 100;
}

/**
 * Whether unpaid company money blocks claiming orders / going online.
 * Waiver always wins. Percentage uses `dueNow` only — accruing never blocks.
 */
export function isDriverPaymentBlockingWork(input: {
  revenueMode: "subscription" | "percentage";
  paymentWaived?: boolean;
  dueNowUsd: number;
  subscriptionStatus: string;
}): boolean {
  if (input.paymentWaived) return false;
  if (input.revenueMode === "percentage") return input.dueNowUsd > 0;
  return (
    input.subscriptionStatus === "frozen" ||
    input.subscriptionStatus === "pending_payment"
  );
}
