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
- `packages/shared` — roles, pricing, Zod schemas, ETA helpers
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

Drivers pay the monthly subscription (plus freeze penalty when frozen) with **Whish Pay merchant collect**, not a freeform P2P transfer to a phone number.

1. The driver taps **Pay with Whish**. The server calls `POST /payment/whish` with `WHISH_CHANNEL` / `WHISH_SECRET` / `WHISH_WEBSITE_URL`.
2. The driver completes payment on the Whish page (phone + OTP).
3. The app polls `POST /payment/collect/status` by `externalId`. When `collectStatus === success`, the subscription unlocks — no admin confirm.
4. Redirects return to the driver dashboard; the callback only re-checks collect status (it is never trusted alone).

The company Whish number in Settings is contact/support info only. It is **not** used to verify payment.

If `WHISH_CHANNEL` / `WHISH_SECRET` are unset, **Pay with Whish** tells the driver to pay manually and **I already paid** logs a pending tx for an admin to confirm in **Budget → Whish**.

Copy `apps/web/.env.example` → `apps/web/.env.local` and fill `WHISH_*` to test against sandbox credentials. Collect amounts are capped at $10,000 so subscription + freeze penalty still fit.

## Revenue modes

Admin → Settings: switch between **subscription** (default) and **percentage of order**. Delivery fees are driver profit under subscription mode.
