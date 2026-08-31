-- Fixed shop location for business profiles (pickup for every order).

alter table public.profiles
  add column if not exists business_address text,
  add column if not exists business_lat double precision,
  add column if not exists business_lng double precision;

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
    business_address, business_lat, business_lng
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
    v_lng
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
