"use client";

import { useEffect, useState } from "react";
import { formatSubscriptionRemaining } from "@direct/shared";

/** Live `day:hour:minute` countdown to a subscription's expiry. */
export function SubscriptionCountdown({ endsAt }: { endsAt: string | null }) {
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Minute-resolution display — a 30s tick is enough to stay accurate.
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return <span>{formatSubscriptionRemaining(endsAtMs, now)}</span>;
}
