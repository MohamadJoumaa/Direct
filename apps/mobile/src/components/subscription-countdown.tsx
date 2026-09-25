import React, { useEffect, useState } from "react";
import { formatSubscriptionRemaining } from "@direct/shared";

import { Text } from "./ui/text";

/**
 * Live `day:hour:minute` countdown to a subscription's expiry.
 *
 * It owns its own clock on purpose. Reading `Date.now()` straight into a
 * screen's render looks right for one frame and then freezes: the store's 5s
 * pass returns the *same state reference* when nothing changed (deliberately —
 * see `applySubscriptionFreeze`), so nothing re-renders and the countdown sits
 * at whatever it said when the screen mounted. A driver watching a number that
 * never moves has no idea whether it is stale or whether time stopped mattering.
 *
 * Mirrors `apps/web/src/components/subscription-countdown.tsx`; the formatting
 * itself is shared (`formatSubscriptionRemaining`), so the two never drift.
 */
export function SubscriptionCountdown({
  endsAt,
  fallback,
  weight = "semibold",
  variant = "callout",
  color,
}: {
  endsAt: string | null;
  /** Shown when the subscription has never started. */
  fallback: string;
  weight?: React.ComponentProps<typeof Text>["weight"];
  variant?: React.ComponentProps<typeof Text>["variant"];
  color?: React.ComponentProps<typeof Text>["color"];
}) {
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Minute-resolution display — a 30s tick is enough to stay accurate.
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Text variant={variant} weight={weight} color={color} numeric>
      {endsAtMs == null ? fallback : formatSubscriptionRemaining(endsAtMs, now)}
    </Text>
  );
}
