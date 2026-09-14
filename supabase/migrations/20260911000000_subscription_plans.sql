-- Daily ($2/24h) subscription plan alongside the existing monthly plan, and
-- the driver order-capacity cap. Mirrors apps/web/src/lib/demo-store.ts and
-- packages/shared/src/subscription.ts; closing the pre-existing drift between
-- this schema and the demo store (whish_transactions has no `kind`;
-- admin_frozen/banned/payment_waived/revenue_mode have no columns here) stays
-- out of scope for this migration.

create type public.subscription_plan as enum ('daily', 'monthly');

alter table public.drivers
  add column if not exists subscription_plan public.subscription_plan not null default 'monthly';

alter table public.company_settings
  add column if not exists subscription_daily_price_usd numeric(10,2) not null default 2,
  add column if not exists max_active_orders int not null default 3;

-- Whish transactions gain the plan the driver was paying for at request time,
-- so a plan switch between request and confirmation cannot mis-credit them.
alter table public.whish_transactions
  add column if not exists plan public.subscription_plan;
