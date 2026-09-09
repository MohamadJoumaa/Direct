# Direct Delivery: mobile (Phase 2)

This directory is a placeholder. There is no Expo app, `package.json`, or native code here yet.

A later Android/iOS client is planned **after** the Phase 1 website is verified:

- Same Supabase database as `apps/web`
- Same design tokens (blue / light gold / white / black)
- Same flows: client, business, driver, admin
- Native push and background location

Do not start this package until Phase 1 web flows pass browser verification. See the [root README](../../README.md) for the website demo.

## Phase 2 checklist — payment (required)

Do **not** re-implement Whish unlock or commission settle in Expo. Import the
shared contract from `@direct/shared` and follow
[`packages/shared/src/payment-rules.md`](../../packages/shared/src/payment-rules.md).

When building the driver pay / go-online / claim flows:

- [ ] Depend on `@direct/shared` (same workspace package web already uses).
- [ ] Unlock **only** when `isWhishCollectPaid(collectStatus)` is true — exact
      `collectStatus === "success"`. Pending / failed / unknown / `"Success"` do
      not unlock.
- [ ] Opening the Whish pay URL or leaving without paying must not unlock.
- [ ] Callback / redirect / deep-link query params must not unlock. Always
      re-verify `POST {WHISH_BASE_URL}{WHISH_COLLECT_STATUS_PATH}` by
      `externalId`.
- [ ] Use `extractCollectPayUrl` / `WHISH_COLLECT_PAY_URL_KEYS` and
      `parseCollectAmountUsd` — do not invent a second URL or amount parser.
- [ ] Company Whish number (`WHISH_NUMBER`) is contact only, never payment proof.
- [ ] If channel/secret are missing, keep the manual **I already paid** + admin
      Confirm fallback.
- [ ] Percentage drivers: `dueNow` from cuts before `workDayStart(at)` (07:00
      Asia/Beirut) minus confirmed commission payments. `accruingToday` never
      blocks. Use `classifyCommissionCut`, `commissionDueNowUsd`, and
      `isDriverPaymentBlockingWork`.
- [ ] Same success-only collect flow for `kind: "subscription"` and
      `kind: "commission"`.
- [ ] Block claim **and** go-online when `isDriverPaymentBlockingWork` is true
      (unless waived). No cron — evaluate on every check.
