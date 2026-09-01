-- Distance-based delivery fare (USD + LBP) with per-service multipliers.

alter table public.company_settings
  add column if not exists night_surcharge_lbp numeric(12,0) not null default 89000,
  add column if not exists fare_min_km numeric(8,2) not null default 3,
  add column if not exists fare_max_km numeric(8,2) not null default 150,
  add column if not exists fare_min_usd numeric(10,2) not null default 2.24,
  add column if not exists fare_max_usd numeric(10,2) not null default 10,
  add column if not exists fare_min_lbp numeric(12,0) not null default 200000,
  add column if not exists fare_max_lbp numeric(12,0) not null default 890000,
  add column if not exists multiplier_normal numeric(8,2) not null default 1,
  add column if not exists multiplier_long_distance numeric(8,2) not null default 1.1,
  add column if not exists multiplier_trusted numeric(8,2) not null default 1.4,
  add column if not exists multiplier_private numeric(8,2) not null default 3.5,
  add column if not exists multiplier_owner numeric(8,2) not null default 1.2,
  add column if not exists multiplier_medical numeric(8,2) not null default 2;

alter table public.orders
  add column if not exists delivery_fee_lbp numeric(12,0) not null default 0;
