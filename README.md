# Direct Delivery Company

Website and mobile application for Direct Delivery Company.

Phase 1 website: **Next.js** + shared package + Supabase schema. Demo mode runs fully in the browser (localStorage) so you can test without credentials.

## Brand

Blue `#1E4DB7` · Light gold `#D4AF37` · White · Black — see `design-system/direct-delivery/MASTER.md`.

## Quick start (demo)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@direct.lb | admin123 |
| Client | client@direct.lb | client123 |
| Business | business@direct.lb | biz123 |
| Fast driver | fast@direct.lb | driver123 |
| Long distance | long@direct.lb | driver123 |
| Trusted | trusted@direct.lb | driver123 |
| Private | private@direct.lb | driver123 |

## Structure

- `apps/web` — Next.js App Router UI
- `packages/shared` — roles, pricing, Zod schemas, ETA helpers, [driver payment rules](packages/shared/src/payment-rules.md)
- `supabase/migrations` — Postgres schema, RLS, `claim_order`, nearby drivers
- `apps/mobile` — Expo placeholder (Phase 2)
- `design-system/direct-delivery` — UI source of truth

## Supabase (production)

1. Create a Supabase project
2. Run `supabase/migrations/20260828000000_init.sql`
3. Copy `.env.example` → `apps/web/.env.local` and fill keys
4. Set `NEXT_PUBLIC_DEMO_MODE=false`
5. Seed an admin via Auth + `raw_app_meta_data.role = admin`

## Google Maps

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Without it, the map panel shows markers and route hints (demo).

## Whish

Drivers pay with **Whish Pay merchant collect**, not a freeform P2P transfer to a phone number. The same success-only rules apply to **subscription** and **commission** (percentage settle). Web and future Expo must import `@direct/shared` helpers — see [`packages/shared/src/payment-rules.md`](packages/shared/src/payment-rules.md).

1. The driver taps **Pay with Whish**. The server calls `POST /payment/whish` with `WHISH_CHANNEL` / `WHISH_SECRET` / `WHISH_WEBSITE_URL`.
2. The driver completes payment on the Whish page (phone + OTP).
3. The app polls `POST /payment/collect/status` by `externalId`. Unlock **only** when `collectStatus === "success"` (exact string) — opening the pay URL, leaving without paying, pending, failed, or unknown does not unlock.
4. Redirects return to the driver dashboard; the callback only re-checks collect status. Callback / redirect alone is **never** payment proof.

The company Whish number in Settings is contact/support info only. It is **not** used to verify payment.

If `WHISH_CHANNEL` / `WHISH_SECRET` are unset, **Pay with Whish** tells the driver to pay manually and **I already paid** logs a pending tx for an admin to confirm in **Budget → Whish**.

Copy `apps/web/.env.example` → `apps/web/.env.local` and fill `WHISH_*` to test against sandbox credentials. Collect amounts are capped at $10,000 so subscription + freeze penalty still fit.

## Revenue modes

Admin → Settings: **subscription** (default) or **percentage of order**.

- **Subscription** — delivery fees stay with the driver. Access is a monthly Whish collect (plus freeze penalty when frozen). Unpaid / frozen drivers cannot claim or go online until collect status is `success` (or admin confirm / waiver).
- **Percentage** — the company cut from each completed order accrues during the current Beirut work day (**07:00 → 07:00 Asia/Beirut**). At/after 07:00, yesterday’s cuts (plus any unpaid backlog) become **due now**. Today’s cuts stay accruing until the next 07:00. The driver pays that `dueNow` with the **same Whish collect → success-only unlock** to keep claiming orders and going online. There is no cron: `workDayStart()` is evaluated on every claim / go-online / payment check.
