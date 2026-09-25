# Driver payment rules (web + mobile)

Single source of truth for unlocking a driver after Whish Pay. Phase 2 Expo
(`apps/mobile`) must import helpers from `@direct/shared` — do not re-implement
these rules in the app.

## Unlock (both `subscription` and `commission`)

Unlock **only** when Whish `collectStatus === "success"` (exact string).

Use `isWhishCollectPaid(collectStatus)` from `@direct/shared`.

The following **must not** unlock:

- Opening the Whish pay URL
- Leaving the Whish page without paying
- `pending`, `failed`, `unknown`, empty, or any other status (including `"Success"`)
- Success/failure **callback** or **redirect** query params alone
- Showing or matching the company Whish number (`WHISH_NUMBER` / Settings)

Always re-verify with `POST /payment/collect/status` by `externalId` before
confirming a tx. Callbacks may redirect the driver back to the app; they are
never payment proof.

## Manual fallback

When `WHISH_CHANNEL` / `WHISH_SECRET` are missing, **Pay with Whish** must not
pretend the collect API succeeded. The driver uses **I already paid**; an admin
confirms in Budget → Whish.

## Company Whish number

Contact / support only **for the collect flow**. Never treat a typed number or
“I sent it to 81…” as paid.

## Mobile: Whish → Whish transfer (Expo)

The Expo app has no merchant credentials to reach, so `DriverPaySheet` hands
the driver to the Whish app (`apps/mobile/src/lib/whish-transfer.ts`) for a
Whish → Whish transfer to `settings.whish_number`, with the number and amount
copied to the clipboard.

This changes **who** confirms, not **what** counts as proof:

- Opening the Whish app unlocks nothing.
- Returning from it unlocks nothing.
- The driver’s “I sent it — confirm” writes a **pending** `manual`
  `whish_transactions` row (with their typed reference in `note`) and unlocks
  nothing. `driverPaymentBlocked` still holds.
- Only an admin calling `confirmWhish` in Budget → Whish extends the
  subscription or clears the commission — the same mutation the web’s manual
  path has always used.

There is exactly **one** open request per driver per `kind`:
`requestSubscriptionPayment` updates the existing pending row instead of adding
a second one, so a double tap cannot read as two payments owed.

`apps/mobile/src/lib/whish.ts` and `hooks/use-whish-collect.ts` are kept and
parked. When merchant credentials exist, re-wire them into `DriverPaySheet`:
collect is verifiable and a P2P transfer never will be.

## Admin waiver

Not a flag that sits on forever. `setDriverPaymentWaived(…, true)` credits one
cycle of the driver's own plan (`waiverGrantMs`): monthly +30 days, daily +24h,
percentage +24h plus a confirmed zero-or-more `commission` transaction writing
off whatever `dueNow` stood at. The subscription extension is additive, and the
grant lapses by itself.

## Percentage: daily settle at 07:00 Asia/Beirut

Work day is **07:00 → 07:00** in `TIMEZONE` (`Asia/Beirut`). Use
`workDayStart(at)` and `classifyCommissionCut(completedAtMs, workDayStartMs)`.

| Bucket | Meaning | Blocks work? |
|--------|---------|--------------|
| `dueNow` | Company cuts from completed/disputed orders **before** the current work-day start, minus confirmed `kind: "commission"` payments (includes unpaid backlog) | Yes, unless waived |
| `accruingToday` | Cuts completed **on or after** the current 07:00 start | No — becomes due at the **next** 07:00 |

No cron is required. Recompute `dueNow` on every claim, go-online, and payment
check. If `dueNow > 0`, the driver cannot claim orders or go online until the
same Whish collect → success-only unlock (or admin confirm / waiver).

## Subscription

Two plans, chosen by the driver: **daily** ($2 / 24h) or **monthly** ($20 / 30
days), plus a freeze penalty when frozen. Same success-only unlock.

Renewal is additive, not a reset: `subscriptionEndsAt(plan, currentEndsAtMs,
nowMs)` extends from `max(now, currentEndsAtMs)`, so paying early never
discards remaining time — two daily payments stack to 48h.

Grace differs by plan: `subscriptionGraceMs(plan, settings)` gives the daily
plan **no grace at all** (it freezes the moment the 24h ends), while monthly
keeps `settings.grace_days`. Grace does not block claiming; `pending_payment`
and `frozen` do.

## Shared exports to use in Expo

Import from `@direct/shared`:

- `WHISH_COLLECT_SUCCESS_STATUS`, `isWhishCollectPaid`
- `WHISH_COLLECT_CREATE_PATH`, `WHISH_COLLECT_STATUS_PATH`
- `WHISH_COLLECT_PAY_URL_KEYS`, `extractCollectPayUrl`, `parseCollectAmountUsd`
- `TIMEZONE`, `WORK_DAY_START_HOUR`, `workDayStart`, `workDayRange`
- `classifyCommissionCut`, `commissionDueNowUsd`, `isDriverPaymentBlockingWork`
- `WHISH_NUMBER` (display / contact only)
- `SUBSCRIPTION_PLANS`, `SUBSCRIPTION_PLAN_MS`, `subscriptionPriceUsd`,
  `subscriptionEndsAt`, `subscriptionGraceMs`, `subscriptionRemaining`,
  `formatSubscriptionRemaining`
- `canAcceptAnotherOrder` (driver order-capacity cap)
- `sequenceStops` (multi-order pickup-before-dropoff route sequencing)
