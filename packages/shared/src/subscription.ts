export const SUBSCRIPTION_PLANS = ["daily", "monthly"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_PLAN_MS: Record<SubscriptionPlan, number> = {
  daily: 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

type PriceSettings = {
  subscription_price_usd: number;
  subscription_daily_price_usd: number;
};

export function subscriptionPriceUsd(plan: SubscriptionPlan, settings: PriceSettings): number {
  return plan === "daily" ? settings.subscription_daily_price_usd : settings.subscription_price_usd;
}

/**
 * Extends from whatever is left, so early renewal never loses time: the new
 * expiry is always `max(now, currentEndsAtMs)` plus the plan's duration.
 */
export function subscriptionEndsAt(
  plan: SubscriptionPlan,
  currentEndsAtMs: number | null,
  nowMs: number,
): number {
  const base = Math.max(nowMs, currentEndsAtMs ?? nowMs);
  return base + SUBSCRIPTION_PLAN_MS[plan];
}

type GraceSettings = { grace_days: number };

/** Daily plans freeze the moment the 24h ends — no grace. Monthly keeps `grace_days`. */
export function subscriptionGraceMs(plan: SubscriptionPlan, settings: GraceSettings): number {
  if (plan === "daily") return 0;
  return Math.max(0, settings.grace_days) * 24 * 60 * 60 * 1000;
}

export type SubscriptionRemaining = {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
};

export function subscriptionRemaining(
  endsAtMs: number | null,
  nowMs: number,
): SubscriptionRemaining {
  const totalMs = endsAtMs == null ? 0 : endsAtMs - nowMs;
  if (endsAtMs == null || totalMs <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, totalMs: 0 };
  }
  const days = Math.floor(totalMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
  return { expired: false, days, hours, minutes, totalMs };
}

/**
 * How close to expiry a subscription has to be before renewing is offered.
 *
 * Renewal is additive -- `subscriptionEndsAt` extends from
 * `max(now, currentEndsAt)` -- so paying early never loses time. The window is
 * not about protecting the driver's balance, it is about the screen: a driver
 * with three weeks left has nothing to decide, and a pay button sitting there
 * is one mis-tap away from charging them for time they already own.
 */
export const SUBSCRIPTION_RENEW_WINDOW_DAYS = 5;

/**
 * Whether the renew / "Pay with Whish" action should be offered at all.
 *
 * True once the subscription is inside the window, and always true once it has
 * expired (`frozen` and `pending_payment` both land here, since neither has
 * time left to protect).
 *
 * Percentage-mode drivers never come through this gate -- theirs is `dueNow`,
 * which is money already owed and must always be payable.
 */
export function isSubscriptionRenewable(
  endsAtMs: number | null,
  nowMs: number,
  windowDays: number = SUBSCRIPTION_RENEW_WINDOW_DAYS,
): boolean {
  const remaining = subscriptionRemaining(endsAtMs, nowMs);
  if (remaining.expired) return true;
  return remaining.totalMs <= Math.max(0, windowDays) * 24 * 60 * 60 * 1000;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "1:06:45" — day:hour:minute, as requested. */
export function formatSubscriptionRemaining(endsAtMs: number | null, nowMs: number): string {
  const r = subscriptionRemaining(endsAtMs, nowMs);
  if (r.expired) return "0:00:00";
  return `${r.days}:${pad2(r.hours)}:${pad2(r.minutes)}`;
}
