-- Direct Delivery — initial schema
-- Roles live in auth.users raw_app_meta_data (never user_metadata for authz)

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Optional PostGIS; nearby falls back to haversine RPC if unavailable
do $$ begin
  create extension if not exists postgis;
exception when others then
  raise notice 'postgis not available — using haversine RPC';
end $$;

create type public.user_role as enum ('admin', 'client', 'business', 'driver');
create type public.driver_type as enum (
  'fast', 'long_distance', 'trusted', 'private', 'owner', 'medical'
);
create type public.order_type as enum (
  'normal', 'long_distance', 'trusted', 'private', 'owner', 'medical'
);
create type public.order_status as enum (
  'pending', 'accepted', 'picked_up', 'at_warehouse', 'in_transit',
  'arrived', 'awaiting_confirmation', 'completed', 'cancelled', 'disputed'
);
create type public.revenue_mode as enum ('subscription', 'percentage');
create type public.subscription_status as enum (
  'active', 'grace', 'frozen', 'pending_payment'
);
create type public.document_status as enum ('pending', 'approved', 'rejected');
create type public.checkin_status as enum ('on_time', 'late', 'missed');
create type public.whish_source as enum ('api', 'manual');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text not null unique,
  role public.user_role not null default 'client',
  business_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key references public.profiles (id) on delete cascade,
  driver_type public.driver_type not null,
  is_online boolean not null default false,
  is_busy boolean not null default false,
  is_trusted boolean not null default false,
  rating_avg numeric(3,2) not null default 5.00,
  rating_count int not null default 0,
  subscription_status public.subscription_status not null default 'pending_payment',
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  doc_type text not null check (doc_type in ('selfie', 'id', 'vehicle_registration')),
  file_path text not null,
  status public.document_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (driver_id, doc_type)
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Items physically stored in a hub (admin-managed; long-distance orders
-- auto-create a row while the package waits at the warehouse).
create table public.warehouse_products (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  name text not null,
  quantity int not null default 1 check (quantity > 0),
  note text not null default '',
  order_id uuid,
  created_at timestamptz not null default now()
);

create table public.company_settings (
  id int primary key default 1 check (id = 1),
  revenue_mode public.revenue_mode not null default 'subscription',
  subscription_price_usd numeric(10,2) not null default 20,
  grace_days int not null default 5,
  freeze_penalty_usd numeric(10,2) not null default 10,
  company_percentage numeric(5,2) not null default 15,
  night_surcharge_usd numeric(10,2) not null default 1,
  whish_number text not null default '81848663',
  price_normal_usd numeric(10,2) not null default 3,
  price_long_distance_usd numeric(10,2) not null default 8,
  price_trusted_usd numeric(10,2) not null default 5,
  price_private_usd numeric(10,2) not null default 25,
  price_owner_usd numeric(10,2) not null default 4,
  price_medical_usd numeric(10,2) not null default 10,
  nearby_radius_km numeric(8,2) not null default 15,
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (1);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id),
  order_type public.order_type not null,
  status public.order_status not null default 'pending',
  product_description text not null,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  warehouse_id uuid references public.warehouses (id),
  assigned_driver_id uuid references public.drivers (id),
  long_distance_driver_id uuid references public.drivers (id),
  delivery_fee_usd numeric(10,2) not null,
  night_surcharge_usd numeric(10,2) not null default 0,
  company_cut_usd numeric(10,2) not null default 0,
  driver_cut_usd numeric(10,2) not null default 0,
  eta_minutes int,
  is_night boolean not null default false,
  dispute_50_50 boolean not null default false,
  client_confirmed_at timestamptz,
  driver_confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders (status);
create index orders_client_idx on public.orders (client_id);
create index orders_driver_idx on public.orders (assigned_driver_id);
create index orders_type_status_idx on public.orders (order_type, status);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.order_confirmations (
  order_id uuid primary key references public.orders (id) on delete cascade,
  client_confirmed boolean not null default false,
  driver_confirmed boolean not null default false,
  client_at timestamptz,
  driver_at timestamptz
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  client_id uuid not null references public.profiles (id),
  driver_id uuid not null references public.drivers (id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'upheld', 'dismissed')),
  admin_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.driver_locations (
  driver_id uuid primary key references public.drivers (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  updated_at timestamptz not null default now()
);

create table public.private_checkins (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  driver_id uuid not null references public.drivers (id),
  check_date date not null default (timezone('Asia/Beirut', now()))::date,
  status public.checkin_status not null,
  note text,
  created_at timestamptz not null default now(),
  unique (order_id, check_date)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  amount_usd numeric(10,2) not null,
  penalty_usd numeric(10,2) not null default 0,
  status public.subscription_status not null default 'pending_payment',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.whish_transactions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers (id),
  amount_usd numeric(10,2) not null,
  phone_ref text,
  external_id text,
  source public.whish_source not null default 'manual',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  note text,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Haversine nearby drivers (km)
create or replace function public.nearby_drivers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15,
  p_driver_type public.driver_type default 'fast'
)
returns table (
  driver_id uuid,
  full_name text,
  phone text,
  driver_type public.driver_type,
  lat double precision,
  lng double precision,
  distance_km double precision,
  rating_avg numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    p.full_name,
    p.phone,
    d.driver_type,
    l.lat,
    l.lng,
    (
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(l.lat))
        ))
      )
    ) as distance_km,
    d.rating_avg
  from public.drivers d
  join public.profiles p on p.id = d.id
  join public.driver_locations l on l.driver_id = d.id
  where d.is_online = true
    and d.driver_type = p_driver_type
    and d.subscription_status in ('active', 'grace')
    and (
      case when d.driver_type = 'fast' then d.is_busy = false else true end
    )
    and (
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(l.lat))
        ))
      )
    ) <= p_radius_km
  order by distance_km asc;
$$;

-- Atomic first-accept claim
create or replace function public.claim_order(p_order_id uuid, p_driver_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_driver public.drivers;
begin
  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found then
    raise exception 'Driver not found';
  end if;
  if v_driver.subscription_status = 'frozen' then
    raise exception 'Subscription frozen';
  end if;
  if v_driver.driver_type = 'fast' and v_driver.is_busy then
    raise exception 'Driver is busy';
  end if;

  update public.orders
  set
    status = 'accepted',
    assigned_driver_id = p_driver_id,
    updated_at = now()
  where id = p_order_id
    and status = 'pending'
    and assigned_driver_id is null
  returning * into v_order;

  if not found then
    raise exception 'Order already taken';
  end if;

  if v_driver.driver_type = 'fast' then
    update public.drivers set is_busy = true where id = p_driver_id;
  end if;

  insert into public.order_events (order_id, actor_id, event_type, note)
  values (p_order_id, p_driver_id, 'accepted', 'Driver accepted order');

  insert into public.order_confirmations (order_id)
  values (p_order_id)
  on conflict do nothing;

  return v_order;
end;
$$;

-- Profile bootstrap on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_driver_type public.driver_type;
begin
  v_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'client');
  insert into public.profiles (id, full_name, email, phone, role, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce(new.email, new.raw_user_meta_data->>'email'),
    coalesce(new.raw_user_meta_data->>'phone', new.id::text),
    v_role,
    new.raw_user_meta_data->>'business_name'
  );

  if v_role = 'driver' then
    v_driver_type := coalesce(
      (new.raw_app_meta_data->>'driver_type')::public.driver_type,
      'fast'
    );
    -- medical not public in phase 1 — still allow seed
    insert into public.drivers (id, driver_type)
    values (new.id, v_driver_type);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lookup email by phone for login
create or replace function public.email_for_phone(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles
  where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1;
$$;

grant execute on function public.email_for_phone(text) to anon, authenticated;
grant execute on function public.nearby_drivers(double precision, double precision, double precision, public.driver_type) to authenticated;
grant execute on function public.claim_order(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_documents enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_products enable row level security;
alter table public.company_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.order_confirmations enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.driver_locations enable row level security;
alter table public.private_checkins enable row level security;
alter table public.subscriptions enable row level security;
alter table public.whish_transactions enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- Drivers
create policy drivers_select on public.drivers for select to authenticated
  using (true);
create policy drivers_update on public.drivers for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- Documents
create policy docs_select on public.driver_documents for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());
create policy docs_insert on public.driver_documents for insert to authenticated
  with check (driver_id = auth.uid() or public.is_admin());
create policy docs_update on public.driver_documents for update to authenticated
  using (public.is_admin() or driver_id = auth.uid());

-- Warehouses
create policy warehouses_select on public.warehouses for select to authenticated using (true);
create policy warehouses_admin on public.warehouses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Warehouse products (admin only)
create policy warehouse_products_admin on public.warehouse_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Settings
create policy settings_select on public.company_settings for select to authenticated using (true);
create policy settings_admin on public.company_settings for update to authenticated
  using (public.is_admin());

-- Orders
create policy orders_select on public.orders for select to authenticated
  using (
    client_id = auth.uid()
    or assigned_driver_id = auth.uid()
    or long_distance_driver_id = auth.uid()
    or public.is_admin()
    or status = 'pending'
  );
create policy orders_insert on public.orders for insert to authenticated
  with check (client_id = auth.uid() or public.is_admin());
create policy orders_update on public.orders for update to authenticated
  using (
    client_id = auth.uid()
    or assigned_driver_id = auth.uid()
    or long_distance_driver_id = auth.uid()
    or public.is_admin()
  );

create policy order_events_select on public.order_events for select to authenticated using (true);
create policy order_events_insert on public.order_events for insert to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

create policy confirmations_all on public.order_confirmations for all to authenticated
  using (true) with check (true);

create policy ratings_select on public.ratings for select to authenticated using (true);
create policy ratings_insert on public.ratings for insert to authenticated
  with check (client_id = auth.uid() or public.is_admin());

create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_update on public.reports for update to authenticated
  using (public.is_admin());

create policy locations_select on public.driver_locations for select to authenticated using (true);
create policy locations_upsert on public.driver_locations for all to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy checkins_select on public.private_checkins for select to authenticated using (true);
create policy checkins_write on public.private_checkins for all to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy subs_select on public.subscriptions for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());
create policy subs_write on public.subscriptions for all to authenticated
  using (public.is_admin() or driver_id = auth.uid())
  with check (public.is_admin() or driver_id = auth.uid());

create policy whish_select on public.whish_transactions for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());
create policy whish_insert on public.whish_transactions for insert to authenticated
  with check (driver_id = auth.uid() or public.is_admin());
create policy whish_update on public.whish_transactions for update to authenticated
  using (public.is_admin());

-- Realtime
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.driver_locations;

-- Storage bucket for trusted docs (run in dashboard if needed)
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

create policy driver_docs_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'driver-documents' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));
create policy driver_docs_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- Seed warehouse (Beirut default)
insert into public.warehouses (name, address, lat, lng)
values ('Direct Hub Beirut', 'Beirut Central Warehouse', 33.8938, 35.5018);
