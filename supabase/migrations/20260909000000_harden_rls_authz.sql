-- Harden production RLS/RPC: JWT admin, claim_order caller lock, column writes.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

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
  if p_driver_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed to claim order';
  end if;

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

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon') then
    raise exception 'profiles.role is not client-writable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

revoke update on table public.profiles from authenticated;
grant update (
  full_name,
  phone,
  avatar_url,
  business_name,
  business_address,
  business_lat,
  business_lng,
  order_min_usd,
  order_max_usd,
  order_min_lbp,
  order_max_lbp,
  updated_at
) on table public.profiles to authenticated;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (
    (select public.is_admin())
    or (
      id = (select auth.uid())
      and role::text is not distinct from coalesce(
        ((select auth.jwt()) -> 'app_metadata' ->> 'role'),
        'client'
      )
    )
  );

create or replace function public.protect_driver_authz_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.subscription_status is distinct from old.subscription_status
       or new.subscription_ends_at is distinct from old.subscription_ends_at
       or new.is_trusted is distinct from old.is_trusted
       or new.rating_avg is distinct from old.rating_avg
       or new.rating_count is distinct from old.rating_count
       or new.driver_type is distinct from old.driver_type then
      raise exception 'driver authz columns are not client-writable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_driver_authz_columns on public.drivers;
create trigger protect_driver_authz_columns
  before update on public.drivers
  for each row execute function public.protect_driver_authz_columns();

drop policy if exists drivers_update on public.drivers;
create policy drivers_update on public.drivers
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists docs_insert on public.driver_documents;
create policy docs_insert on public.driver_documents
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (
      driver_id = (select auth.uid())
      and status = 'pending'
      and reviewed_by is null
      and reviewed_at is null
    )
  );

drop policy if exists docs_update on public.driver_documents;
create policy docs_update_admin on public.driver_documents
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy docs_update_own_file on public.driver_documents
  for update to authenticated
  using (driver_id = (select auth.uid()) and status = 'pending')
  with check (
    driver_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists subs_write on public.subscriptions;
create policy subs_write on public.subscriptions
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists confirmations_all on public.order_confirmations;

create policy confirmations_select on public.order_confirmations
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.client_id = (select auth.uid())
          or o.assigned_driver_id = (select auth.uid())
          or o.long_distance_driver_id = (select auth.uid())
        )
    )
  );

create policy confirmations_insert on public.order_confirmations
  for insert to authenticated
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.client_id = (select auth.uid())
          or o.assigned_driver_id = (select auth.uid())
          or o.long_distance_driver_id = (select auth.uid())
        )
    )
  );

create policy confirmations_update on public.order_confirmations
  for update to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.client_id = (select auth.uid())
          or o.assigned_driver_id = (select auth.uid())
          or o.long_distance_driver_id = (select auth.uid())
        )
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.client_id = (select auth.uid())
          or o.assigned_driver_id = (select auth.uid())
          or o.long_distance_driver_id = (select auth.uid())
        )
    )
  );

create policy confirmations_delete on public.order_confirmations
  for delete to authenticated
  using ((select public.is_admin()));

create or replace function public.protect_order_confirmations()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client uuid;
  v_assigned uuid;
  v_long uuid;
  v_uid uuid := (select auth.uid());
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  select o.client_id, o.assigned_driver_id, o.long_distance_driver_id
    into v_client, v_assigned, v_long
  from public.orders o
  where o.id = new.order_id;

  if v_uid is not distinct from v_client then
    if tg_op = 'UPDATE' then
      new.driver_confirmed := old.driver_confirmed;
      new.driver_at := old.driver_at;
    else
      new.driver_confirmed := false;
      new.driver_at := null;
    end if;
  elsif v_uid is not distinct from v_assigned
     or v_uid is not distinct from v_long then
    if tg_op = 'UPDATE' then
      new.client_confirmed := old.client_confirmed;
      new.client_at := old.client_at;
    else
      new.client_confirmed := false;
      new.client_at := null;
    end if;
  else
    raise exception 'Not allowed to write order confirmation';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_order_confirmations on public.order_confirmations;
create trigger protect_order_confirmations
  before insert or update on public.order_confirmations
  for each row execute function public.protect_order_confirmations();
