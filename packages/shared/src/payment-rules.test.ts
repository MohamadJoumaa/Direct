import assert from "node:assert/strict";
import { test } from "node:test";
import { workDayStart } from "./beirut-time.ts";
import {
  classifyCommissionCut,
  commissionDueNowUsd,
  extractCollectPayUrl,
  isDriverPaymentBlockingWork,
  isWhishCollectPaid,
  parseCollectAmountUsd,
} from "./payment-rules.ts";

test("isWhishCollectPaid is exact-string success only", () => {
  assert.equal(isWhishCollectPaid("success"), true);
  assert.equal(isWhishCollectPaid("Success"), false);
  assert.equal(isWhishCollectPaid("SUCCESS"), false);
  assert.equal(isWhishCollectPaid("pending"), false);
  assert.equal(isWhishCollectPaid("failed"), false);
  assert.equal(isWhishCollectPaid("unknown"), false);
  assert.equal(isWhishCollectPaid(""), false);
  assert.equal(isWhishCollectPaid(undefined), false);
  assert.equal(isWhishCollectPaid({ collectStatus: "success" }), false);
});

test("workDayStart flips due vs accruing at 07:00 Beirut", () => {
  const afterSeven = new Date("2026-03-20T10:00:00.000Z");
  const start = workDayStart(afterSeven);
  const justBefore = new Date(start.getTime() - 1);
  const overnightOrder = new Date(start.getTime() - 60_000);

  assert.ok(workDayStart(justBefore).getTime() < start.getTime());
  assert.equal(workDayStart(start).getTime(), start.getTime());
  assert.equal(workDayStart(new Date(start.getTime() + 1)).getTime(), start.getTime());

  assert.equal(
    classifyCommissionCut(overnightOrder.getTime(), workDayStart(justBefore).getTime()),
    "accruing",
  );
  assert.equal(
    classifyCommissionCut(overnightOrder.getTime(), start.getTime()),
    "due",
  );

  const previousAfternoon = new Date(start.getTime() - 12 * 60 * 60 * 1000);
  assert.equal(
    classifyCommissionCut(previousAfternoon.getTime(), workDayStart(justBefore).getTime()),
    "accruing",
  );
  assert.equal(classifyCommissionCut(previousAfternoon.getTime(), start.getTime()), "due");

  const olderThanPreviousStart = new Date(workDayStart(justBefore).getTime() - 60_000);
  assert.equal(
    classifyCommissionCut(olderThanPreviousStart.getTime(), workDayStart(justBefore).getTime()),
    "due",
  );
  assert.equal(classifyCommissionCut(olderThanPreviousStart.getTime(), start.getTime()), "due");

  const afterBoundary = new Date(start.getTime() + 60 * 60 * 1000);
  assert.equal(classifyCommissionCut(afterBoundary.getTime(), start.getTime()), "accruing");
});

test("commissionDueNowUsd subtracts confirmed payments and never goes negative", () => {
  assert.equal(commissionDueNowUsd(12.5, 4), 8.5);
  assert.equal(commissionDueNowUsd(4, 12.5), 0);
  assert.equal(commissionDueNowUsd(0, 0), 0);
});

test("percentage dueNow blocks work; accruing / waiver do not", () => {
  assert.equal(
    isDriverPaymentBlockingWork({
      revenueMode: "percentage",
      dueNowUsd: 3.25,
      subscriptionStatus: "active",
    }),
    true,
  );
  assert.equal(
    isDriverPaymentBlockingWork({
      revenueMode: "percentage",
      dueNowUsd: 0,
      subscriptionStatus: "active",
    }),
    false,
  );
  assert.equal(
    isDriverPaymentBlockingWork({
      revenueMode: "percentage",
      paymentWaived: true,
      dueNowUsd: 9,
      subscriptionStatus: "active",
    }),
    false,
  );
});

test("subscription frozen / pending_payment block; grace does not", () => {
  assert.equal(
    isDriverPaymentBlockingWork({
      revenueMode: "subscription",
      dueNowUsd: 0,
      subscriptionStatus: "frozen",
    }),
    true,
  );
  assert.equal(
    isDriverPaymentBlockingWork({
      revenueMode: "subscription",
      dueNowUsd: 0,
      subscriptionStatus: "pending_payment",
    }),
    true,
  );
  assert.equal(
    isDriverPaymentBlockingWork({
      revenueMode: "subscription",
      dueNowUsd: 0,
      subscriptionStatus: "grace",
    }),
    false,
  );
});

test("parseCollectAmountUsd and extractCollectPayUrl stay conservative", () => {
  assert.equal(parseCollectAmountUsd(20), 20);
  assert.equal(parseCollectAmountUsd(0), null);
  assert.equal(parseCollectAmountUsd(10_001), null);
  assert.equal(
    extractCollectPayUrl({ data: { collectUrl: "https://pay.example/x" } }),
    "https://pay.example/x",
  );
  assert.equal(extractCollectPayUrl({ url: "not-a-url" }), null);
});
