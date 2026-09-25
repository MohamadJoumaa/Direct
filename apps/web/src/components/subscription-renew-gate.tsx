"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SUBSCRIPTION_RENEW_WINDOW_DAYS, isSubscriptionRenewable } from "@direct/shared";
import { fmt, useI18n } from "@/lib/i18n";

/**
 * Shows the pay actions only when renewing actually makes sense.
 *
 * Renewal is additive — `subscriptionEndsAt` extends from
 * `max(now, currentEndsAt)` — so a driver with three weeks left gains nothing
 * by paying today, and a mis-tap costs them a month's fee. Inside the window
 * (or once expired, frozen, or never started) the actions come back.
 *
 * `now` lives in state and ticks, rather than being read during render: the
 * window closes on its own while the page is open, and the Expo app applies
 * the identical `isSubscriptionRenewable` rule from `@direct/shared`.
 */
export function SubscriptionRenewGate({
  endsAt,
  /** Percentage drivers owe money that is already due; never gate that. */
  alwaysOpen = false,
  children,
}: {
  endsAt: string | null;
  alwaysOpen?: boolean;
  children: ReactNode;
}) {
  const { dict } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Minute-resolution decision — a 30s tick keeps it honest without work.
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const open =
    alwaysOpen || isSubscriptionRenewable(endsAt ? new Date(endsAt).getTime() : null, now);

  if (open) return <>{children}</>;

  return (
    <p className="text-base text-muted-foreground">
      {fmt(dict.driver.renewWindowHint, { days: SUBSCRIPTION_RENEW_WINDOW_DAYS })}
    </p>
  );
}
