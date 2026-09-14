import type { DeliveryQuote } from "./index";

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Cash LBP is quoted in thousands. */
export function roundLbp(n: number): number {
  return Math.round(n / 1000) * 1000;
}

export function formatLbp(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} LBP`;
}

export function formatDeliveryCash(usd: number, lbp?: number | null): string {
  const usdPart = `$${usd.toFixed(2)}`;
  if (lbp == null || Number.isNaN(lbp)) return usdPart;
  return `${usdPart} · ${formatLbp(lbp)}`;
}

/** An urgent order costs three times the normal quote. */
export const URGENT_PRICE_MULTIPLIER = 3;

/**
 * Urgency multiplies the whole quote — base *and* night surcharge — because
 * the driver drops everything else for it, whatever hour it is.
 */
export function applyUrgentPricing(quote: DeliveryQuote, urgent: boolean): DeliveryQuote {
  if (!urgent) return quote;
  return {
    ...quote,
    baseUsd: roundUsd(quote.baseUsd * URGENT_PRICE_MULTIPLIER),
    baseLbp: roundLbp(quote.baseLbp * URGENT_PRICE_MULTIPLIER),
    nightUsd: roundUsd(quote.nightUsd * URGENT_PRICE_MULTIPLIER),
    nightLbp: roundLbp(quote.nightLbp * URGENT_PRICE_MULTIPLIER),
    totalUsd: roundUsd(quote.totalUsd * URGENT_PRICE_MULTIPLIER),
    totalLbp: roundLbp(quote.totalLbp * URGENT_PRICE_MULTIPLIER),
  };
}

export type ClientPriceInput = {
  /** What the client typed, in USD. */
  requestedUsd: number;
  /** The quoted price for this order — the floor the client cannot go under. */
  quotedUsd: number;
};

/**
 * A client may pay *more* than the quote (a tip that gets a driver faster) but
 * never less. Returns null when the value is acceptable, a reason otherwise.
 */
export function clientPriceError(input: ClientPriceInput): "invalid" | "below_quote" | null {
  if (!Number.isFinite(input.requestedUsd) || input.requestedUsd <= 0) return "invalid";
  // Cents-level rounding noise must not read as "below the quote".
  if (roundUsd(input.requestedUsd) < roundUsd(input.quotedUsd) - 0.001) return "below_quote";
  return null;
}

/**
 * The LBP side follows the USD the client set, keeping the quote's own
 * USD↔LBP ratio so both currencies stay in step.
 */
export function scaleLbpToUsd(
  requestedUsd: number,
  quotedUsd: number,
  quotedLbp: number,
): number {
  if (quotedUsd <= 0) return roundLbp(quotedLbp);
  return roundLbp((requestedUsd / quotedUsd) * quotedLbp);
}
