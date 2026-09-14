import assert from "node:assert/strict";
import { test } from "node:test";
import {
  URGENT_PRICE_MULTIPLIER,
  applyUrgentPricing,
  clientPriceError,
  scaleLbpToUsd,
} from "./order-price.ts";

/** Shape of a `quoteDeliveryPrice` result; built literally so this test file
 *  stays free of the barrel import (node --test cannot resolve it). */
function quote(over: Partial<Parameters<typeof applyUrgentPricing>[0]> = {}) {
  return {
    distanceKm: 10,
    multiplier: 1,
    baseUsd: 4,
    baseLbp: 360_000,
    nightUsd: 0,
    nightLbp: 0,
    totalUsd: 4,
    totalLbp: 360_000,
    ...over,
  };
}

test("urgent triples every cash line of the quote", () => {
  const urgent = applyUrgentPricing(quote(), true);
  assert.equal(urgent.totalUsd, 12);
  assert.equal(urgent.totalLbp, 1_080_000);
  assert.equal(urgent.baseUsd, 12);
  assert.equal(urgent.baseLbp, 1_080_000);
  assert.equal(URGENT_PRICE_MULTIPLIER, 3);
});

test("urgent keeps the non-cash fields of the quote", () => {
  const urgent = applyUrgentPricing(quote({ distanceKm: 42, multiplier: 1.4 }), true);
  assert.equal(urgent.distanceKm, 42);
  assert.equal(urgent.multiplier, 1.4);
});

test("urgent triples the night surcharge too", () => {
  const night = quote({ nightUsd: 2, nightLbp: 89_000, totalUsd: 6, totalLbp: 449_000 });
  const urgent = applyUrgentPricing(night, true);
  assert.equal(urgent.nightUsd, 6);
  assert.equal(urgent.nightLbp, 267_000);
  assert.equal(urgent.totalUsd, 18);
});

test("not urgent leaves the quote untouched", () => {
  const q = quote();
  assert.equal(applyUrgentPricing(q, false), q);
});

test("client may pay the quote or more, never less", () => {
  assert.equal(clientPriceError({ requestedUsd: 5, quotedUsd: 5 }), null);
  assert.equal(clientPriceError({ requestedUsd: 8, quotedUsd: 5 }), null);
  assert.equal(clientPriceError({ requestedUsd: 4.99, quotedUsd: 5 }), "below_quote");
  assert.equal(clientPriceError({ requestedUsd: 0, quotedUsd: 5 }), "invalid");
  assert.equal(clientPriceError({ requestedUsd: -1, quotedUsd: 5 }), "invalid");
  assert.equal(clientPriceError({ requestedUsd: Number.NaN, quotedUsd: 5 }), "invalid");
});

test("floating-point noise at the quote itself is not 'below quote'", () => {
  // 0.1 + 0.2 === 0.30000000000000004; the mirrored case must still pass.
  assert.equal(clientPriceError({ requestedUsd: 0.3, quotedUsd: 0.1 + 0.2 }), null);
});

test("LBP follows the USD the client set, keeping the quote's ratio", () => {
  assert.equal(scaleLbpToUsd(10, 5, 400_000), 800_000);
  assert.equal(scaleLbpToUsd(5, 5, 400_000), 400_000);
  // A zero quote cannot define a ratio — keep the quoted LBP as-is.
  assert.equal(scaleLbpToUsd(10, 0, 400_000), 400_000);
});
