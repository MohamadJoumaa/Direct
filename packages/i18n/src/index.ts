/**
 * @direct/i18n — the two dictionaries and the pure helpers around them.
 *
 * React lives in each client: web keeps a context provider that drives
 * `document.documentElement.dir`, Expo keeps one that drives `I18nManager`.
 * Only the data and the string helpers are shared, so adding a key still means
 * adding it to both dictionaries — they must keep the same shape.
 */
import type { OrderStatus, OrderType } from "@direct/shared";
import { en, type Dictionary } from "./en";
import { ar } from "./ar";

export { en, ar };
export type { Dictionary };

export type Lang = "en" | "ar";

/** Persisted language choice. Same key on both clients. */
export const LANG_STORAGE_KEY = "direct-lang";

export const DICTS: Record<Lang, Dictionary> = { en, ar };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "ar";
}

export function dirForLang(lang: Lang): "ltr" | "rtl" {
  return lang === "ar" ? "rtl" : "ltr";
}

export { fmt } from "./format";

export function orderStatusLabel(status: OrderStatus | string, dict: Dictionary): string {
  return dict.orderStatus[status as OrderStatus] ?? status.replaceAll("_", " ");
}

export function orderTypeLabel(_type: OrderType, dict: Dictionary): string {
  return dict.order.delivery;
}

export { notificationCopy, type NotificationLike } from "./notification-copy";
