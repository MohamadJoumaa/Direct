-- Per-business min/max cash per order. Only admins may change these values.

alter table public.profiles
  add column if not exists order_min_usd numeric(10,2),
  add column if not exists order_max_usd numeric(10,2),
  add column if not exists order_min_lbp numeric(12,0),
  add column if not exists order_max_lbp numeric(12,0);

update public.profiles
set
  order_min_usd = coalesce(order_min_usd, 2.24),
  order_max_usd = coalesce(order_max_usd, 10),
  order_min_lbp = coalesce(order_min_lbp, 200000),
  order_max_lbp = coalesce(order_max_lbp, 890000)
where role = 'business';

alter table public.profiles
  drop constraint if exists profiles_order_costs_range;

alter table public.profiles
  add constraint profiles_order_costs_range check (
    role <> 'business'
    or (
      order_min_usd is not null
      and order_max_usd is not null
      and order_min_lbp is not null
      and order_max_lbp is not null
      and order_min_usd >= 0
      and order_max_usd >= order_min_usd
      and order_min_lbp >= 0
      and order_max_lbp >= order_min_lbp
    )
  );

create or replace function public.protect_business_order_costs()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.order_min_usd := old.order_min_usd;
    new.order_max_usd := old.order_max_usd;
    new.order_min_lbp := old.order_min_lbp;
    new.order_max_lbp := old.order_max_lbp;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_business_order_costs on public.profiles;
create trigger protect_business_order_costs
  before update on public.profiles
  for each row execute function public.protect_business_order_costs();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_driver_type public.driver_type;
  v_lat double precision;
  v_lng double precision;
begin
  v_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'client');

  begin
    v_lat := (new.raw_user_meta_data->>'business_lat')::double precision;
  exception when others then
    v_lat := null;
  end;
  begin
    v_lng := (new.raw_user_meta_data->>'business_lng')::double precision;
  exception when others then
    v_lng := null;
  end;

  insert into public.profiles (
    id, full_name, email, phone, role, business_name,
    business_address, business_lat, business_lng,
    order_min_usd, order_max_usd, order_min_lbp, order_max_lbp
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce(new.email, new.raw_user_meta_data->>'email'),
    coalesce(new.raw_user_meta_data->>'phone', new.id::text),
    v_role,
    new.raw_user_meta_data->>'business_name',
    new.raw_user_meta_data->>'business_address',
    v_lat,
    v_lng,
    case when v_role = 'business' then 2.24 else null end,
    case when v_role = 'business' then 10 else null end,
    case when v_role = 'business' then 200000 else null end,
    case when v_role = 'business' then 890000 else null end
  );

  if v_role = 'driver' then
    v_driver_type := coalesce(
      (new.raw_app_meta_data->>'driver_type')::public.driver_type,
      'fast'
    );
    insert into public.drivers (id, driver_type)
    values (new.id, v_driver_type);
  end if;

  return new;
end;
$$;
