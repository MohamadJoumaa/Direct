import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatSubscriptionRemaining,
  subscriptionEndsAt,
  subscriptionGraceMs,
  subscriptionPriceUsd,
  subscriptionRemaining,
} from "./subscription.ts";

const SETTINGS = {
  subscription_price_usd: 20,
  subscription_daily_price_usd: 2,
  grace_days: 5,
};

test("subscriptionPriceUsd picks the right plan price", () => {
  assert.equal(subscriptionPriceUsd("daily", SETTINGS), 2);
  assert.equal(subscriptionPriceUsd("monthly", SETTINGS), 20);
});

test("daily = 24h exactly, monthly = 30 days exactly", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  assert.equal(subscriptionEndsAt("daily", null, now) - now, 24 * 60 * 60 * 1000);
  assert.equal(subscriptionEndsAt("monthly", null, now) - now, 30 * 24 * 60 * 60 * 1000);
});

test("daily grace is zero; monthly keeps settings.grace_days", () => {
  assert.equal(subscriptionGraceMs("daily", SETTINGS), 0);
  assert.equal(subscriptionGraceMs("monthly", SETTINGS), 5 * 24 * 60 * 60 * 1000);
  assert.equal(subscriptionGraceMs("monthly", { grace_days: 0 }), 0);
});

test("renewal is additive: stacking two daily payments gives 48h, not a reset", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const firstEnd = subscriptionEndsAt("daily", null, now);
  assert.equal(firstEnd - now, 24 * 60 * 60 * 1000);
  // Pay again before expiry — remaining time must not be discarded.
  const laterButBeforeExpiry = now + 2 * 60 * 60 * 1000; // 2h in
  const secondEnd = subscriptionEndsAt("daily", firstEnd, laterButBeforeExpiry);
  assert.equal(secondEnd - now, 48 * 60 * 60 * 1000);
});

test("renewal after expiry starts fresh from now, never goes negative", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const pastEnd = now - 10 * 24 * 60 * 60 * 1000; // expired 10 days ago
  const renewed = subscriptionEndsAt("monthly", pastEnd, now);
  assert.equal(renewed - now, 30 * 24 * 60 * 60 * 1000);
});

test("subscriptionRemaining breaks down days/hours/minutes and flags expired", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const end = now + (1 * 24 + 6) * 60 * 60 * 1000 + 45 * 60 * 1000; // 1d 6h 45m
  const r = subscriptionRemaining(end, now);
  assert.deepEqual(r, {
    expired: false,
    days: 1,
    hours: 6,
    minutes: 45,
    totalMs: r.totalMs,
  });
  assert.equal(subscriptionRemaining(now - 1, now).expired, true);
  assert.equal(subscriptionRemaining(null, now).expired, true);
});

test("formatSubscriptionRemaining renders d:hh:mm, including the expired case", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const end = now + (1 * 24 + 6) * 60 * 60 * 1000 + 45 * 60 * 1000;
  assert.equal(formatSubscriptionRemaining(end, now), "1:06:45");
  assert.equal(formatSubscriptionRemaining(now - 1, now), "0:00:00");
  assert.equal(formatSubscriptionRemaining(null, now), "0:00:00");
  const almostADay = now + 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
  assert.equal(formatSubscriptionRemaining(almostADay, now), "0:23:59");
});
