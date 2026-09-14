-- Client-set order prices, urgent (×3) orders, and the driver who hands a
-- package in at the hub. Mirrors apps/web/src/lib/demo-store.ts and
-- packages/shared/src/order-price.ts.

-- What Direct quoted for the trip, kept alongside what the client actually
-- pays: the quote is the floor a client price edit can never go under.
alter table public.orders
  add column if not exists quoted_fee_usd numeric(10,2) not null default 0,
  add column if not exists quoted_fee_lbp numeric(12,0) not null default 0,
  add column if not exists is_urgent boolean not null default false;

-- Orders placed before price edits existed charged exactly what was quoted.
update public.orders
   set quoted_fee_usd = delivery_fee_usd,
       quoted_fee_lbp = delivery_fee_lbp
 where quoted_fee_usd = 0
   and quoted_fee_lbp = 0;

-- A client may pay above the quote to attract a driver, never below it.
alter table public.orders
  drop constraint if exists orders_fee_at_least_quote;
alter table public.orders
  add constraint orders_fee_at_least_quote
  check (delivery_fee_usd >= quoted_fee_usd);

-- Who physically brought this package to the warehouse.
alter table public.warehouse_products
  add column if not exists delivered_by_driver_id uuid references public.drivers (id),
  add column if not exists delivered_at timestamptz;

-- Clients and businesses upload a selfie and an ID; only drivers add vehicle
-- papers, so the licence type joins the list and the check keeps the set closed.
alter table public.driver_documents
  drop constraint if exists driver_documents_doc_type_check;
alter table public.driver_documents
  add constraint driver_documents_doc_type_check
  check (doc_type in ('selfie', 'id', 'vehicle_registration', 'driver_license'));
