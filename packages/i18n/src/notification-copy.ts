import { fmt } from "./format";
import type { Dictionary } from "./en";

/** Kinds whose whole copy lives in the dictionary — title and body, no args. */
const STATIC_COPY = {
  docs_approved: ["docsApprovedTitle", "docsApprovedBody"],
  account_frozen: ["accountFrozenTitle", "accountFrozenBody"],
  account_unfrozen: ["accountUnfrozenTitle", "accountUnfrozenBody"],
  account_banned: ["accountBannedTitle", "accountBannedBody"],
  account_reinstated: ["accountReinstatedTitle", "accountReinstatedBody"],
  payment_waived: ["paymentWaivedTitle", "paymentWaivedBody"],
  payment_required: ["paymentRequiredTitle", "paymentRequiredBody"],
} as const;

/** Only what the copy needs, so this file stays free of a store dependency. */
export type NotificationLike = {
  title: string;
  body: string;
  kind?: string;
  order_id?: string;
};

/**
 * Notifications are stored in English so any reader can fall back to them, but
 * everything with a `kind` renders from the dictionary — a driver reading the
 * app in Arabic sees Arabic, whatever language it was written in.
 *
 * Routing is deliberately not decided here: the web and Expo route tables
 * differ, so each client turns the returned `kind` / `order_id` into its own
 * destination.
 */
export function notificationCopy(
  n: NotificationLike,
  dict: Dictionary,
  /** Renders "#1200" for an order id, or "" when the order is unknown. */
  orderNumberFor: (orderId: string | undefined) => string,
): { title: string; body: string } {
  if (n.kind === "order_offered") {
    const number = orderNumberFor(n.order_id);
    return {
      title: dict.driver.orderOfferedTitle,
      body: number
        ? fmt(dict.driver.orderOfferedBody, { number })
        : dict.driver.orderOfferedTitle,
    };
  }
  if (n.kind === "order_cancelled") {
    const number = orderNumberFor(n.order_id);
    return {
      title: dict.driver.orderCancelledTitle,
      body: number
        ? fmt(dict.driver.orderCancelledBody, { number })
        : dict.driver.orderCancelledBodyFallback,
    };
  }
  const staticCopy = n.kind ? STATIC_COPY[n.kind as keyof typeof STATIC_COPY] : undefined;
  if (staticCopy) {
    const [titleKey, bodyKey] = staticCopy;
    return { title: dict.notify[titleKey], body: dict.notify[bodyKey] };
  }
  return { title: n.title, body: n.body };
}
