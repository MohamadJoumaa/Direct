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

Contact / support only. Never treat a typed number or “I sent it to 81…” as
paid.

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

Monthly collect (plus freeze penalty when frozen). Same success-only unlock.
Grace does not block claiming; `pending_payment` and `frozen` do.

## Shared exports to use in Expo

Import from `@direct/shared`:

- `WHISH_COLLECT_SUCCESS_STATUS`, `isWhishCollectPaid`
- `WHISH_COLLECT_CREATE_PATH`, `WHISH_COLLECT_STATUS_PATH`
- `WHISH_COLLECT_PAY_URL_KEYS`, `extractCollectPayUrl`, `parseCollectAmountUsd`
- `TIMEZONE`, `WORK_DAY_START_HOUR`, `workDayStart`, `workDayRange`
- `classifyCommissionCut`, `commissionDueNowUsd`, `isDriverPaymentBlockingWork`
- `WHISH_NUMBER` (display / contact only)
