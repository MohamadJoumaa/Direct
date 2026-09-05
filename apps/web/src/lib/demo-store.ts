import {
  DEFAULT_BUSINESS_ORDER_COSTS,
  DEFAULT_SETTINGS,
  canAcceptAnotherOrder,
  clampQuoteToBusinessCosts,
  estimateEtaMinutes,
  haversineKm,
  quoteDeliveryPrice,
  roundLbp,
  splitRevenue,
  validateBusinessOrderCosts,
  withBusinessOrderCosts,
  workDayStart,
  type BusinessOrderCosts,
  type CompanySettings,
  type DriverType,
  type OrderStatus,
  type OrderType,
  type UserRole,
} from "@direct/shared";
import { locationLabel } from "@/lib/place-name";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  business_name?: string;
  business_address?: string;
  business_lat?: number;
  business_lng?: number;
  order_min_usd?: number;
  order_max_usd?: number;
  order_min_lbp?: number;
  order_max_lbp?: number;
  avatar_url?: string;
  created_at: string;
};

const DEFAULT_SHOP = {
  business_address: "Hamra, Beirut",
  business_lat: 33.8959,
  business_lng: 35.478,
};

export type Driver = {
  id: string;
  driver_type: DriverType;
  is_online: boolean;
  is_busy: boolean;
  is_trusted: boolean;
  rating_avg: number;
  rating_count: number;
  subscription_status: "active" | "grace" | "frozen" | "pending_payment";
  subscription_ends_at: string | null;
  /** Admin freeze — independent of subscription expiry. */
  admin_frozen: boolean;
  banned: boolean;
};

export type DriverReviewStatus = "paid" | "grace" | "frozen" | "banned" | "unpaid";
export type DriverPayMethod = "whish" | "whish_manual" | "none";

export function driverReviewStatus(driver: Driver): DriverReviewStatus {
  if (driver.banned) return "banned";
  if (driver.admin_frozen || driver.subscription_status === "frozen") return "frozen";
  if (driver.subscription_status === "grace") return "grace";
  if (driver.subscription_status === "pending_payment") return "unpaid";
  return "paid";
}

export function driverCannotWork(driver: Driver): boolean {
  return (
    driver.banned ||
    driver.admin_frozen ||
    driver.subscription_status === "frozen" ||
    driver.subscription_status === "pending_payment"
  );
}

/** Latest Whish attempt for this driver (list is newest-first). */
export function driverPayMethod(state: DemoState, driverId: string): DriverPayMethod {
  const latest = state.whish.find((t) => t.driver_id === driverId);
  if (!latest) return "none";
  return latest.source === "api" ? "whish" : "whish_manual";
}

/** First public order number in the shared sequence (client + business + admin). */
export const FIRST_PUBLIC_ORDER_NUMBER = 1200;

export function formatOrderNumber(n: number): string {
  return `#${n}`;
}

export function nextAvailableOrderNumber(state: {
  orders: { order_number?: number }[];
  next_order_number?: number;
}): number {
  const maxAssigned = state.orders.reduce((m, o) => Math.max(m, o.order_number ?? 0), 0);
  return Math.max(
    state.next_order_number ?? FIRST_PUBLIC_ORDER_NUMBER,
    maxAssigned + 1,
    FIRST_PUBLIC_ORDER_NUMBER,
  );
}

export type Order = {
  id: string;
  /** Short public id shared across client, business, driver, and admin. */
  order_number: number;
  client_id: string;
  order_type: OrderType;
  status: OrderStatus;
  product_description: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  warehouse_id: string | null;
  assigned_driver_id: string | null;
  long_distance_driver_id: string | null;
  delivery_fee_usd: number;
  delivery_fee_lbp: number;
  night_surcharge_usd: number;
  company_cut_usd: number;
  driver_cut_usd: number;
  eta_minutes: number | null;
  is_night: boolean;
  dispute_50_50: boolean;
  client_confirmed: boolean;
  driver_confirmed: boolean;
  rating_stars: number | null;
  created_at: string;
  completed_at: string | null;
};

export type DriverLocation = {
  driver_id: string;
  lat: number;
  lng: number;
  updated_at: string;
};

export type Report = {
  id: string;
  order_id: string;
  reporter_id: string;
  reason: string;
  status: "open" | "upheld" | "dismissed";
  created_at: string;
};

export type WhishKind = "subscription" | "commission";

export type WhishTx = {
  id: string;
  driver_id: string;
  amount_usd: number;
  phone_ref: string;
  source: "api" | "manual";
  status: "pending" | "confirmed" | "failed";
  kind: WhishKind;
  note: string;
  external_id: string | null;
  created_at: string;
  confirmed_at: string | null;
};

export type DriverDocument = {
  id: string;
  driver_id: string;
  doc_type: "selfie" | "id" | "vehicle_registration" | "driver_license";
  file_name: string;
  file_data?: string; // base64 data URL for preview
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type PrivateCheckin = {
  id: string;
  order_id: string;
  driver_id: string;
  check_date: string;
  status: "on_time" | "late" | "missed";
  note: string;
};

export type Warehouse = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type WarehouseProduct = {
  id: string;
  warehouse_id: string;
  name: string;
  quantity: number;
  note: string;
  order_id: string | null;
  created_at: string;
};

export type DemoState = {
  profiles: Profile[];
  drivers: Driver[];
  orders: Order[];
  locations: DriverLocation[];
  reports: Report[];
  whish: WhishTx[];
  documents: DriverDocument[];
  checkins: PrivateCheckin[];
  warehouses: Warehouse[];
  products: WarehouseProduct[];
  notifications: Notification[];
  settings: CompanySettings;
  /** Next unused public order number (never reused). */
  next_order_number: number;
  sessionUserId: string | null;
  viewingAs: UserRole | null;
};

const STORAGE_KEY = "direct-delivery-demo-v1";

function uid() {
  return crypto.randomUUID();
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function seed(): DemoState {
  const adminId = "00000000-0000-4000-8000-000000000001";
  const clientId = "00000000-0000-4000-8000-000000000002";
  const fastId = "00000000-0000-4000-8000-000000000003";
  const longId = "00000000-0000-4000-8000-000000000004";
  const trustedId = "00000000-0000-4000-8000-000000000005";
  const privateId = "00000000-0000-4000-8000-000000000006";
  const ownerId = "00000000-0000-4000-8000-000000000007";
  const bizId = "00000000-0000-4000-8000-000000000008";

  return {
    profiles: [
      {
        id: adminId,
        full_name: "Admin Direct",
        email: "admin@direct.lb",
        phone: "70000001",
        password: "admin123",
        role: "admin",
        created_at: new Date().toISOString(),
      },
      {
        id: clientId,
        full_name: "Sara Client",
        email: "client@direct.lb",
        phone: "70000002",
        password: "client123",
        role: "client",
        created_at: new Date().toISOString(),
      },
      {
        id: bizId,
        full_name: "Omar Business",
        email: "business@direct.lb",
        phone: "70000008",
        password: "biz123",
        role: "business",
        business_name: "Omar Shop",
        business_address: DEFAULT_SHOP.business_address,
        business_lat: DEFAULT_SHOP.business_lat,
        business_lng: DEFAULT_SHOP.business_lng,
        ...DEFAULT_BUSINESS_ORDER_COSTS,
        created_at: new Date().toISOString(),
      },
      {
        id: fastId,
        full_name: "Ali Fast",
        email: "fast@direct.lb",
        phone: "70000003",
        password: "driver123",
        role: "driver",
        created_at: new Date().toISOString(),
      },
      {
        id: longId,
        full_name: "Rami Long",
        email: "long@direct.lb",
        phone: "70000004",
        password: "driver123",
        role: "driver",
        created_at: new Date().toISOString(),
      },
      {
        id: trustedId,
        full_name: "Maya Trusted",
        email: "trusted@direct.lb",
        phone: "70000005",
        password: "driver123",
        role: "driver",
        created_at: new Date().toISOString(),
      },
      {
        id: privateId,
        full_name: "Karim Private",
        email: "private@direct.lb",
        phone: "70000006",
        password: "driver123",
        role: "driver",
        created_at: new Date().toISOString(),
      },
      {
        id: ownerId,
        full_name: "Owner Driver",
        email: "owner@direct.lb",
        phone: "70000007",
        password: "driver123",
        role: "driver",
        created_at: new Date().toISOString(),
      },
    ],
    drivers: [
      {
        id: adminId,
        driver_type: "owner",
        is_online: true,
        is_busy: false,
        is_trusted: true,
        rating_avg: 5,
        rating_count: 0,
        subscription_status: "active",
        subscription_ends_at: daysFromNow(365),
        admin_frozen: false,
        banned: false,
      },
      {
        id: fastId,
        driver_type: "fast",
        is_online: true,
        is_busy: false,
        is_trusted: false,
        rating_avg: 4.8,
        rating_count: 12,
        subscription_status: "active",
        subscription_ends_at: daysFromNow(20),
        admin_frozen: false,
        banned: false,
      },
      {
        id: longId,
        driver_type: "long_distance",
        is_online: true,
        is_busy: false,
        is_trusted: false,
        rating_avg: 4.6,
        rating_count: 8,
        subscription_status: "active",
        subscription_ends_at: daysFromNow(12),
        admin_frozen: false,
        banned: false,
      },
      {
        id: trustedId,
        driver_type: "trusted",
        is_online: true,
        is_busy: false,
        is_trusted: true,
        rating_avg: 4.9,
        rating_count: 20,
        subscription_status: "active",
        subscription_ends_at: daysFromNow(25),
        admin_frozen: false,
        banned: false,
      },
      {
        id: privateId,
        driver_type: "private",
        is_online: true,
        is_busy: false,
        is_trusted: false,
        rating_avg: 4.7,
        rating_count: 5,
        subscription_status: "grace",
        subscription_ends_at: daysFromNow(-2),
        admin_frozen: false,
        banned: false,
      },
      {
        id: ownerId,
        driver_type: "owner",
        is_online: true,
        is_busy: false,
        is_trusted: false,
        rating_avg: 5,
        rating_count: 3,
        subscription_status: "active",
        subscription_ends_at: daysFromNow(30),
        admin_frozen: false,
        banned: false,
      },
    ],
    locations: [
      { driver_id: adminId, lat: 33.8938, lng: 35.502, updated_at: new Date().toISOString() },
      { driver_id: fastId, lat: 33.8938, lng: 35.5018, updated_at: new Date().toISOString() },
      { driver_id: longId, lat: 33.9, lng: 35.51, updated_at: new Date().toISOString() },
      { driver_id: trustedId, lat: 33.88, lng: 35.49, updated_at: new Date().toISOString() },
      { driver_id: privateId, lat: 33.87, lng: 35.52, updated_at: new Date().toISOString() },
      { driver_id: ownerId, lat: 33.895, lng: 35.505, updated_at: new Date().toISOString() },
    ],
    orders: [
      {
        id: "ord-demo-completed-fast",
        order_number: FIRST_PUBLIC_ORDER_NUMBER,
        client_id: clientId,
        order_type: "normal",
        status: "completed",
        product_description: "Documents envelope",
        pickup_address: "Hamra, Beirut",
        pickup_lat: 33.8959,
        pickup_lng: 35.478,
        dropoff_address: "Achrafieh, Beirut",
        dropoff_lat: 33.8869,
        dropoff_lng: 35.5194,
        warehouse_id: null,
        assigned_driver_id: fastId,
        long_distance_driver_id: null,
        delivery_fee_usd: 4,
        delivery_fee_lbp: 360000,
        night_surcharge_usd: 0,
        company_cut_usd: 1,
        driver_cut_usd: 3,
        eta_minutes: 18,
        is_night: false,
        dispute_50_50: false,
        client_confirmed: true,
        driver_confirmed: true,
        rating_stars: 5,
        created_at: daysFromNow(-2),
        completed_at: daysFromNow(-2),
      },
    ],
    reports: [],
    whish: [
      {
        id: uid(),
        driver_id: fastId,
        amount_usd: 20,
        phone_ref: "70000003",
        source: "manual",
        status: "confirmed",
        kind: "subscription",
        note: "Monthly subscription",
        external_id: null,
        created_at: daysFromNow(-10),
        confirmed_at: daysFromNow(-10),
      },
    ],
    documents: [],
    notifications: [],
    checkins: [],
    products: [],
    warehouses: [
      {
        id: "wh-beirut",
        name: "Direct Hub Beirut",
        address: "Beirut Central Warehouse",
        lat: 33.8938,
        lng: 35.5018,
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
    next_order_number: FIRST_PUBLIC_ORDER_NUMBER + 1,
    sessionUserId: null,
    viewingAs: null,
  };
}

/** SSR-safe initial state: never touches localStorage, so the first client
    render matches the server HTML. Real state loads in a mount effect. */
export function initialState(): DemoState {
  return seed();
}

export function loadState(): DemoState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as DemoState;
    return migrateState(parsed);
  } catch {
    return seed();
  }
}

export function saveState(state: DemoState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Admin always has an owner driver row so driver-view has no restrictions. */
function ensureAdminDriver(state: DemoState): DemoState {
  const admin = state.profiles.find((p) => p.role === "admin");
  if (!admin) return state;
  const hasRow = state.drivers.some((d) => d.id === admin.id);
  const hasLoc = state.locations.some((l) => l.driver_id === admin.id);
  if (hasRow && hasLoc) return state;
  return {
    ...state,
    drivers: hasRow
      ? state.drivers
      : [
          ...state.drivers,
          {
            id: admin.id,
            driver_type: "owner",
            is_online: true,
            is_busy: false,
            is_trusted: true,
            rating_avg: 5,
            rating_count: 0,
            subscription_status: "active",
            subscription_ends_at: daysFromNow(365),
            admin_frozen: false,
            banned: false,
          },
        ],
    locations: hasLoc
      ? state.locations
      : [
          ...state.locations,
          { driver_id: admin.id, lat: 33.8938, lng: 35.502, updated_at: new Date().toISOString() },
        ],
  };
}

function migrateState(parsed: DemoState): DemoState {
  const next: DemoState = {
    ...parsed,
    products: parsed.products ?? [],
    warehouses: parsed.warehouses ?? [],
    notifications: parsed.notifications ?? [],
    profiles: (parsed.profiles ?? []).map((p) => {
      if (p.role !== "business") return p;
      const withShop =
        p.business_lat != null &&
        p.business_lng != null &&
        p.business_address &&
        p.business_address.trim().length >= 3
          ? p
          : {
              ...p,
              business_address: p.business_address?.trim() || DEFAULT_SHOP.business_address,
              business_lat: p.business_lat ?? DEFAULT_SHOP.business_lat,
              business_lng: p.business_lng ?? DEFAULT_SHOP.business_lng,
            };
      return { ...withShop, ...withBusinessOrderCosts(withShop) };
    }),
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    drivers: (parsed.drivers ?? []).map((d) => ({
      ...d,
      admin_frozen: d.admin_frozen ?? false,
      banned: d.banned ?? false,
    })),
    orders: (parsed.orders ?? []).map((o) => ({
      ...o,
      delivery_fee_lbp: o.delivery_fee_lbp ?? 0,
      order_number: typeof o.order_number === "number" ? o.order_number : 0,
    })),
    next_order_number: parsed.next_order_number ?? FIRST_PUBLIC_ORDER_NUMBER,
    whish: (parsed.whish ?? []).map((t) => ({
      ...t,
      kind: t.kind === "commission" ? "commission" : "subscription",
      external_id: t.external_id ?? (t.source === "api" ? t.note : null),
    })),
  };
  return ensureOrderNumbers(ensureAdminDriver(next));
}

function ensureOrderNumbers(state: DemoState): DemoState {
  const used = new Set<number>();
  for (const o of state.orders) {
    if (o.order_number >= FIRST_PUBLIC_ORDER_NUMBER) used.add(o.order_number);
  }
  let cursor = FIRST_PUBLIC_ORDER_NUMBER;
  const byAge = [...state.orders].toSorted(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  const assigned = new Map<string, number>();
  for (const o of byAge) {
    if (o.order_number >= FIRST_PUBLIC_ORDER_NUMBER) {
      assigned.set(o.id, o.order_number);
      continue;
    }
    while (used.has(cursor)) cursor += 1;
    assigned.set(o.id, cursor);
    used.add(cursor);
    cursor += 1;
  }
  const maxAssigned = state.orders.reduce((m, o) => Math.max(m, assigned.get(o.id) ?? 0), 0);
  return {
    ...state,
    next_order_number: Math.max(
      state.next_order_number ?? FIRST_PUBLIC_ORDER_NUMBER,
      maxAssigned + 1,
      FIRST_PUBLIC_ORDER_NUMBER,
    ),
    orders: state.orders.map((o) => ({ ...o, order_number: assigned.get(o.id)! })),
  };
}

export function resetDemo() {
  const s = seed();
  saveState(s);
  return s;
}

function digits(s: string) {
  return s.replace(/\D/g, "");
}

export function registerUser(
  state: DemoState,
  input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    business_name?: string;
    business_address?: string;
    business_lat?: number;
    business_lng?: number;
    driver_type?: DriverType;
  },
): { state: DemoState; error?: string; userId?: string } {
  if (state.profiles.some((p) => p.email.toLowerCase() === input.email.toLowerCase())) {
    return { state, error: "This email is already used" };
  }
  if (state.profiles.some((p) => digits(p.phone) === digits(input.phone))) {
    return { state, error: "This phone number is already used" };
  }
  if (input.role === "business") {
    if (!input.business_name || input.business_name.trim().length < 2) {
      return { state, error: "Enter your business name" };
    }
    if (
      !input.business_address ||
      input.business_address.trim().length < 3 ||
      typeof input.business_lat !== "number" ||
      typeof input.business_lng !== "number"
    ) {
      return { state, error: "Pin your shop on the map" };
    }
  }
  const id = uid();
  const profile: Profile = {
    id,
    full_name: input.full_name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    password: input.password,
    role: input.role,
    business_name: input.business_name,
    business_address:
      input.role === "business"
        ? locationLabel(input.business_address, input.business_lat, input.business_lng)
        : undefined,
    business_lat: input.role === "business" ? input.business_lat : undefined,
    business_lng: input.role === "business" ? input.business_lng : undefined,
    ...(input.role === "business" ? DEFAULT_BUSINESS_ORDER_COSTS : {}),
    created_at: new Date().toISOString(),
  };
  const next = { ...state, profiles: [...state.profiles, profile] };
  if (input.role === "driver" && input.driver_type) {
    if (input.driver_type === "medical") {
      return { state, error: "Medical drivers are not available yet" };
    }
    next.drivers = [
      ...next.drivers,
      {
        id,
        driver_type: input.driver_type,
        is_online: false,
        is_busy: false,
        is_trusted: false,
        rating_avg: 5,
        rating_count: 0,
        subscription_status: "pending_payment",
        subscription_ends_at: null,
        admin_frozen: false,
        banned: false,
      },
    ];
    next.locations = [
      ...next.locations,
      { driver_id: id, lat: 33.8938, lng: 35.5018, updated_at: new Date().toISOString() },
    ];
  }
  next.sessionUserId = id;
  return { state: next, userId: id };
}

export function loginUser(
  state: DemoState,
  identifier: string,
  password: string,
): { state: DemoState; error?: string } {
  const id = identifier.trim().toLowerCase();
  const profile = state.profiles.find(
    (p) =>
      p.email.toLowerCase() === id ||
      digits(p.phone) === digits(identifier) ||
      p.phone === identifier,
  );
  if (!profile || profile.password !== password) {
    return { state, error: "Wrong email/phone or password" };
  }
  return { state: { ...state, sessionUserId: profile.id, viewingAs: null } };
}

export function createOrder(
  state: DemoState,
  clientId: string,
  input: {
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    product_description: string;
    order_type: OrderType;
  },
): { state: DemoState; error?: string; order?: Order } {
  const pendingConfirm = state.orders.find(
    (o) =>
      o.client_id === clientId &&
      (o.status === "awaiting_confirmation" ||
        (o.status === "arrived" && !o.client_confirmed)),
  );
  if (pendingConfirm && !pendingConfirm.client_confirmed) {
    return {
      state,
      error: "Please confirm and rate your last delivery before creating a new order",
    };
  }
  if (input.order_type === "medical") {
    return { state, error: "Medical delivery is not available yet" };
  }

  const client = state.profiles.find((p) => p.id === clientId);
  let pickupAddress = input.pickup_address;
  let pickupLat = input.pickup_lat;
  let pickupLng = input.pickup_lng;
  if (client?.role === "business") {
    if (
      client.business_lat == null ||
      client.business_lng == null ||
      !client.business_address?.trim()
    ) {
      return { state, error: "Your shop location is missing. Ask an admin to set it." };
    }
    pickupAddress = client.business_address.trim();
    pickupLat = client.business_lat;
    pickupLng = client.business_lng;
  }

  const dist = haversineKm(
    pickupLat,
    pickupLng,
    input.dropoff_lat,
    input.dropoff_lng,
  );
  const quoted = quoteDeliveryPrice(input.order_type, state.settings, dist);
  const quote =
    client?.role === "business"
      ? clampQuoteToBusinessCosts(quoted, withBusinessOrderCosts(client))
      : quoted;
  const split = splitRevenue(quote.totalUsd, state.settings, quote.baseUsd);
  const warehouse =
    input.order_type === "long_distance" ? state.warehouses[0] ?? null : null;

  const order_number = nextAvailableOrderNumber(state);
  const order: Order = {
    id: uid(),
    order_number,
    client_id: clientId,
    order_type: input.order_type,
    status: "pending",
    product_description: input.product_description,
    pickup_address: locationLabel(pickupAddress, pickupLat, pickupLng),
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_address: locationLabel(input.dropoff_address, input.dropoff_lat, input.dropoff_lng),
    dropoff_lat: input.dropoff_lat,
    dropoff_lng: input.dropoff_lng,
    warehouse_id: warehouse?.id ?? null,
    assigned_driver_id: null,
    long_distance_driver_id: null,
    delivery_fee_usd: quote.totalUsd,
    delivery_fee_lbp: quote.totalLbp,
    night_surcharge_usd: quote.nightUsd,
    company_cut_usd: split.company_cut,
    driver_cut_usd: split.driver_cut,
    eta_minutes: estimateEtaMinutes(dist, input.order_type),
    is_night: quote.nightUsd > 0,
    dispute_50_50: false,
    client_confirmed: false,
    driver_confirmed: false,
    rating_stars: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };

  // Owner orders: notify admins — leave pending for admin/owner claim
  return {
    state: {
      ...state,
      orders: [order, ...state.orders],
      next_order_number: order_number + 1,
    },
    order,
  };
}

export function claimOrder(
  state: DemoState,
  orderId: string,
  driverId: string,
): { state: DemoState; error?: string } {
  const actor = state.profiles.find((p) => p.id === driverId);
  const isAdminActor = actor?.role === "admin";
  let driver = state.drivers.find((d) => d.id === driverId);

  // Admins can take owner orders without a driver profile
  if (!driver && isAdminActor) {
    driver = {
      id: driverId,
      driver_type: "owner",
      is_online: true,
      is_busy: false,
      is_trusted: false,
      rating_avg: 5,
      rating_count: 0,
      subscription_status: "active",
      subscription_ends_at: daysFromNow(365),
      admin_frozen: false,
      banned: false,
    };
  }

  if (!driver) return { state, error: "Driver not found" };

  const percentageMode = state.settings.revenue_mode === "percentage";
  if (!isAdminActor && percentageMode) {
    const due = driverCommissionTotals(state, driverId).dueNow;
    if (due > 0) {
      return {
        state,
        error: `Pay yesterday's company cut ($${due.toFixed(2)}) via Whish first`,
      };
    }
  }
  if (!isAdminActor && driver.banned) {
    return { state, error: "This account is banned" };
  }
  if (!isAdminActor && driver.admin_frozen) {
    return { state, error: "Your account is frozen by an admin" };
  }
  if (!isAdminActor && !percentageMode && driver.subscription_status === "frozen") {
    return { state, error: "Your account is frozen. Pay subscription + $10 to reactivate." };
  }
  if (!isAdminActor && !percentageMode && driver.subscription_status === "pending_payment") {
    return { state, error: "Pay your subscription first (Whish 81848663)" };
  }

  const activeCount = state.orders.filter(
    (o) =>
      (o.assigned_driver_id === driverId || o.long_distance_driver_id === driverId) &&
      !["completed", "cancelled"].includes(o.status),
  ).length;

  if (
    !isAdminActor &&
    !percentageMode &&
    !canAcceptAnotherOrder(driver.driver_type, activeCount)
  ) {
    return { state, error: "Finish your current delivery first" };
  }

  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { state, error: "Order not found" };
  if (order.status !== "pending" && !(order.status === "at_warehouse" && order.order_type === "long_distance")) {
    return { state, error: "This order was already taken" };
  }

  // Match driver type to order — admins skip every type restriction.
  if (!isAdminActor) {
    if (order.order_type === "normal" && driver.driver_type !== "fast") {
      return { state, error: "Only fast drivers can take this order" };
    }
    if (order.order_type === "trusted" && driver.driver_type !== "trusted") {
      return { state, error: "Only trusted drivers can take this order" };
    }
    if (order.order_type === "private" && driver.driver_type !== "private") {
      return { state, error: "Only private drivers can take this order" };
    }
    if (order.order_type === "owner" && driver.driver_type !== "owner") {
      return { state, error: "Owner / admin only" };
    }
    if (order.order_type === "long_distance") {
      if (order.status === "pending" && driver.driver_type !== "fast") {
        return { state, error: "A fast driver must take it to the warehouse first" };
      }
      if (order.status === "at_warehouse" && driver.driver_type !== "long_distance") {
        return { state, error: "A long-distance driver must take it from the warehouse" };
      }
    }
  }

  const fromWarehouse = order.order_type === "long_distance" && order.status === "at_warehouse";

  const orders = state.orders.map((o) => {
    if (o.id !== orderId) return o;
    if (fromWarehouse) {
      return {
        ...o,
        status: "in_transit" as OrderStatus,
        long_distance_driver_id: driverId,
      };
    }
    return {
      ...o,
      status: "accepted" as OrderStatus,
      assigned_driver_id: driverId,
    };
  });

  // Persist the synthesized admin driver row so busy/online tracking works.
  const hasRow = state.drivers.some((d) => d.id === driverId);
  const baseDrivers = hasRow ? state.drivers : [...state.drivers, driver];

  const drivers = baseDrivers.map((d) => {
    if (d.id !== driverId) return d;
    if (d.driver_type === "fast" && !isAdminActor && !percentageMode) {
      return { ...d, is_busy: true };
    }
    return d;
  });

  // Leaving the hub: the linked product leaves the warehouse shelf too.
  const products = fromWarehouse
    ? state.products.filter((p) => p.order_id !== orderId)
    : state.products;

  return { state: { ...state, orders, drivers, products } };
}

export function advanceOrder(
  state: DemoState,
  orderId: string,
  actorId: string,
  action: "picked_up" | "at_warehouse" | "in_transit" | "arrived",
): { state: DemoState; error?: string } {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { state, error: "Order not found" };
  const isDriver =
    order.assigned_driver_id === actorId ||
    order.long_distance_driver_id === actorId ||
    state.profiles.find((p) => p.id === actorId)?.role === "admin";
  if (!isDriver) return { state, error: "Only the driver can do this" };

  const statusMap: Record<string, OrderStatus> = {
    picked_up: "picked_up",
    at_warehouse: "at_warehouse",
    in_transit: "in_transit",
    arrived: "awaiting_confirmation",
  };

  let drivers = state.drivers;
  if (action === "at_warehouse" && order.assigned_driver_id) {
    drivers = drivers.map((d) =>
      d.id === order.assigned_driver_id ? { ...d, is_busy: false } : d,
    );
  }

  const orders = state.orders.map((o) =>
    o.id === orderId ? { ...o, status: statusMap[action] } : o,
  );

  // Package physically enters the hub: track it as a warehouse product.
  let products = state.products;
  if (action === "at_warehouse" && order.warehouse_id) {
    const already = products.some((p) => p.order_id === orderId);
    if (!already) {
      products = [
        {
          id: uid(),
          warehouse_id: order.warehouse_id,
          name: order.product_description || "Package",
          quantity: 1,
          note: `Order ${order.id.slice(0, 8)} — waiting for long-distance driver`,
          order_id: orderId,
          created_at: new Date().toISOString(),
        },
        ...products,
      ];
    }
  }

  return { state: { ...state, orders, drivers, products } };
}

export function confirmDelivery(
  state: DemoState,
  orderId: string,
  userId: string,
  who: "client" | "driver",
  stars?: number,
): { state: DemoState; error?: string } {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { state, error: "Order not found" };
  if (!["arrived", "awaiting_confirmation"].includes(order.status) && order.status !== "completed") {
    if (order.status !== "in_transit" && order.status !== "picked_up") {
      // allow confirm only after arrived
    }
  }
  if (!["awaiting_confirmation", "arrived", "in_transit", "picked_up"].includes(order.status)) {
    // For simplicity after "arrived" maps to awaiting_confirmation
  }

  let next = { ...order };
  if (who === "client") {
    if (order.client_id !== userId && state.profiles.find((p) => p.id === userId)?.role !== "admin") {
      return { state, error: "Only the client can confirm" };
    }
    if (!stars || stars < 1) return { state, error: "Please rate the driver (1–5 stars)" };
    next = { ...next, client_confirmed: true, rating_stars: stars };
  } else {
    const isDriver =
      order.assigned_driver_id === userId ||
      order.long_distance_driver_id === userId ||
      state.profiles.find((p) => p.id === userId)?.role === "admin";
    if (!isDriver) return { state, error: "Only the driver can confirm" };
    next = { ...next, driver_confirmed: true };
  }

  let drivers = state.drivers;
  if (next.client_confirmed && next.driver_confirmed) {
    next = {
      ...next,
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    const driverId = next.long_distance_driver_id ?? next.assigned_driver_id;
    if (driverId) {
      drivers = drivers.map((d) => {
        if (d.id !== driverId && d.id !== next.assigned_driver_id) return d;
        let updated = { ...d, is_busy: false };
        if (who === "client" && stars && d.id === (next.long_distance_driver_id ?? next.assigned_driver_id)) {
          const count = d.rating_count + 1;
          const avg = (d.rating_avg * d.rating_count + stars) / count;
          updated = { ...updated, rating_avg: Math.round(avg * 100) / 100, rating_count: count };
        }
        return updated.id === d.id ? updated : d;
      });
      // Fix rating update properly
      const rateId = next.long_distance_driver_id ?? next.assigned_driver_id;
      if (stars && rateId) {
        drivers = drivers.map((d) => {
          if (d.id !== rateId) {
            if (d.id === next.assigned_driver_id) return { ...d, is_busy: false };
            return d;
          }
          const count = d.rating_count + 1;
          const avg = (d.rating_avg * d.rating_count + stars) / count;
          return {
            ...d,
            is_busy: false,
            rating_avg: Math.round(avg * 100) / 100,
            rating_count: count,
          };
        });
      }
    }
  } else {
    next = { ...next, status: "awaiting_confirmation" };
  }

  const orders = state.orders.map((o) => (o.id === orderId ? next : o));
  return { state: { ...state, orders, drivers } };
}

export function reportClient(
  state: DemoState,
  orderId: string,
  reporterId: string,
  reason: string,
): { state: DemoState; error?: string } {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { state, error: "Order not found" };
  const report: Report = {
    id: uid(),
    order_id: orderId,
    reporter_id: reporterId,
    reason,
    status: "open",
    created_at: new Date().toISOString(),
  };
  return { state: { ...state, reports: [report, ...state.reports] } };
}

export function resolveReport(
  state: DemoState,
  reportId: string,
  upheld: boolean,
): DemoState {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) return state;
  const reports = state.reports.map((r) =>
    r.id === reportId ? { ...r, status: upheld ? ("upheld" as const) : ("dismissed" as const) } : r,
  );
  let orders = state.orders;
  if (upheld) {
    orders = orders.map((o) => {
      if (o.id !== report.order_id) return o;
      const half = Math.round((o.delivery_fee_usd / 2) * 100) / 100;
      return {
        ...o,
        dispute_50_50: true,
        driver_cut_usd: half,
        company_cut_usd: o.company_cut_usd,
        status: "disputed",
      };
    });
  }
  return { ...state, reports, orders };
}

export function updateLocation(
  state: DemoState,
  driverId: string,
  lat: number,
  lng: number,
): DemoState {
  const exists = state.locations.some((l) => l.driver_id === driverId);
  const locations = exists
    ? state.locations.map((l) =>
        l.driver_id === driverId
          ? { ...l, lat, lng, updated_at: new Date().toISOString() }
          : l,
      )
    : [
        ...state.locations,
        { driver_id: driverId, lat, lng, updated_at: new Date().toISOString() },
      ];
  return { ...state, locations };
}

export function setOnline(
  state: DemoState,
  driverId: string,
  online: boolean,
  lat?: number,
  lng?: number,
): { state: DemoState; error?: string } {
  if (online && (lat == null || lng == null)) {
    return { state, error: "Turn on location to go online" };
  }
  let next = ensureAdminDriver(state);
  const hasRow = next.drivers.some((d) => d.id === driverId);
  if (!hasRow) return { state, error: "Driver not found" };
  const row = next.drivers.find((d) => d.id === driverId);
  if (online && row?.banned) {
    return { state, error: "This account is banned" };
  }
  if (online && row?.admin_frozen) {
    return { state, error: "Your account is frozen by an admin" };
  }
  next = {
    ...next,
    drivers: next.drivers.map((d) =>
      d.id === driverId ? { ...d, is_online: online } : d,
    ),
  };
  if (online && lat != null && lng != null) {
    next = updateLocation(next, driverId, lat, lng);
  }
  return { state: next };
}

export type RequestPayOpts = {
  source?: "api" | "manual";
  externalId?: string;
  kind?: WhishKind;
  amount?: number;
};

export function requestSubscriptionPayment(
  state: DemoState,
  driverId: string,
  opts?: RequestPayOpts,
): DemoState {
  const kind: WhishKind =
    opts?.kind ??
    (state.settings.revenue_mode === "percentage" ? "commission" : "subscription");
  const frozen =
    state.drivers.find((d) => d.id === driverId)?.subscription_status === "frozen";
  const amount =
    opts?.amount ??
    (kind === "commission"
      ? driverCommissionTotals(state, driverId).dueNow
      : state.settings.subscription_price_usd +
        (frozen ? state.settings.freeze_penalty_usd : 0));
  if (kind === "commission" && amount <= 0) return state;
  const profile = state.profiles.find((p) => p.id === driverId);
  const tx: WhishTx = {
    id: uid(),
    driver_id: driverId,
    amount_usd: amount,
    phone_ref: profile?.phone ?? "",
    source: opts?.source ?? "manual",
    status: "pending",
    kind,
    note: opts?.externalId
      ? `Whish ${opts.externalId}`
      : kind === "commission"
        ? `Direct commission — ${profile?.full_name ?? "driver"}`
        : `Pay Whish ${state.settings.whish_number}`,
    external_id: opts?.externalId ?? null,
    created_at: new Date().toISOString(),
    confirmed_at: null,
  };
  return { ...state, whish: [tx, ...state.whish] };
}

export function confirmWhish(
  state: DemoState,
  txId: string,
): DemoState {
  const tx = state.whish.find((t) => t.id === txId);
  if (!tx) return state;
  const whish = state.whish.map((t) =>
    t.id === txId
      ? { ...t, status: "confirmed" as const, confirmed_at: new Date().toISOString() }
      : t,
  );
  if (tx.kind === "commission") {
    return { ...state, whish };
  }
  const ends = daysFromNow(30);
  const drivers = state.drivers.map((d) =>
    d.id === tx.driver_id
      ? {
          ...d,
          subscription_status: "active" as const,
          subscription_ends_at: ends,
        }
      : d,
  );
  return { ...state, whish, drivers };
}

export function applySubscriptionFreeze(state: DemoState): DemoState {
  const now = Date.now();
  const graceMs = state.settings.grace_days * 24 * 60 * 60 * 1000;
  const drivers = state.drivers.map((d) => {
    if (!d.subscription_ends_at) return d;
    if (state.settings.revenue_mode === "percentage") return d;
    const end = new Date(d.subscription_ends_at).getTime();
    if (now <= end) return { ...d, subscription_status: "active" as const };
    if (now <= end + graceMs) return { ...d, subscription_status: "grace" as const };
    return { ...d, subscription_status: "frozen" as const };
  });
  return { ...state, drivers };
}

export function addDocument(
  state: DemoState,
  driverId: string,
  doc_type: DriverDocument["doc_type"],
  file_name: string,
  file_data?: string,
): DemoState {
  const documents = [
    {
      id: uid(),
      driver_id: driverId,
      doc_type,
      file_name,
      file_data,
      status: "pending" as const,
      created_at: new Date().toISOString(),
    },
    ...state.documents.filter((d) => !(d.driver_id === driverId && d.doc_type === doc_type)),
  ];
  let profiles = state.profiles;
  if (doc_type === "selfie" && file_data) {
    profiles = profiles.map((p) =>
      p.id === driverId ? { ...p, avatar_url: file_data } : p,
    );
  }
  return { ...state, documents, profiles };
}

export function approveDocument(
  state: DemoState,
  docId: string,
  approve: boolean,
): DemoState {
  const documents = state.documents.map((d) =>
    d.id === docId
      ? { ...d, status: approve ? ("approved" as const) : ("rejected" as const) }
      : d,
  );
  const doc = documents.find((d) => d.id === docId);
  let drivers = state.drivers;
  let profiles = state.profiles;
  let notifications = state.notifications;
  if (doc && approve) {
    if (doc.doc_type === "selfie" && doc.file_data) {
      profiles = profiles.map((p) =>
        p.id === doc.driver_id ? { ...p, avatar_url: doc.file_data } : p,
      );
    }
    const required = ["selfie", "id", "vehicle_registration", "driver_license"] as const;
    const ok = required.every((t) =>
      documents.some(
        (d) => d.driver_id === doc.driver_id && d.doc_type === t && d.status === "approved",
      ),
    );
    if (ok) {
      drivers = drivers.map((d) =>
        d.id === doc.driver_id ? { ...d, is_trusted: true, driver_type: "trusted" } : d,
      );
      // Send verification notification
      notifications = [
        {
          id: uid(),
          user_id: doc.driver_id,
          title: "Verification complete",
          body: "All your documents have been approved. You are now a verified driver!",
          read: false,
          created_at: new Date().toISOString(),
        },
        ...notifications,
      ];
    }
  }
  return { ...state, documents, drivers, profiles, notifications };
}

export function markNotificationRead(state: DemoState, notifId: string): DemoState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notifId ? { ...n, read: true } : n,
    ),
  };
}

export function addCheckin(
  state: DemoState,
  orderId: string,
  driverId: string,
  status: PrivateCheckin["status"],
  note: string,
): DemoState {
  const today = new Date().toISOString().slice(0, 10);
  const checkins = [
    {
      id: uid(),
      order_id: orderId,
      driver_id: driverId,
      check_date: today,
      status,
      note,
    },
    ...state.checkins.filter((c) => !(c.order_id === orderId && c.check_date === today)),
  ];
  return { ...state, checkins };
}

export function driverRevenue(
  state: DemoState,
  driverId: string,
  period: "today" | "yesterday" | "week" | "month",
): { profit: number; orders: number } {
  const now = new Date();
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
  }
  if (period === "week") start.setDate(start.getDate() - 7);
  if (period === "month") start.setDate(start.getDate() - 30);

  const completed = state.orders.filter((o) => {
    if (o.status !== "completed" && o.status !== "disputed") return false;
    const did =
      o.assigned_driver_id === driverId || o.long_distance_driver_id === driverId;
    if (!did || !o.completed_at) return false;
    const t = new Date(o.completed_at).getTime();
    if (period === "yesterday") {
      return t >= start.getTime() && t < now.getTime();
    }
    return t >= start.getTime();
  });

  return {
    profit: completed.reduce((s, o) => s + o.driver_cut_usd, 0),
    orders: completed.length,
  };
}

export function subscriptionBudget(state: DemoState): number {
  return state.whish
    .filter((t) => t.status === "confirmed" && t.kind === "subscription")
    .reduce((s, t) => s + t.amount_usd, 0);
}

export function percentageAccrued(state: DemoState): number {
  return state.orders
    .filter((o) => o.status === "completed" || o.status === "disputed")
    .reduce((s, o) => s + o.company_cut_usd, 0);
}

function earningDriverId(order: Order): string | null {
  return order.long_distance_driver_id ?? order.assigned_driver_id;
}

export function driverCommissionTotals(
  state: DemoState,
  driverId: string,
  at: Date = new Date(),
): { dueNow: number; accruingToday: number } {
  const startMs = workDayStart(at).getTime();
  let due = 0;
  let accruing = 0;
  for (const o of state.orders) {
    if (o.status !== "completed" && o.status !== "disputed") continue;
    if (earningDriverId(o) !== driverId || !o.completed_at) continue;
    const t = new Date(o.completed_at).getTime();
    if (t < startMs) due += o.company_cut_usd;
    else accruing += o.company_cut_usd;
  }
  const paid = state.whish
    .filter(
      (tx) =>
        tx.driver_id === driverId &&
        tx.status === "confirmed" &&
        tx.kind === "commission",
    )
    .reduce((s, tx) => s + tx.amount_usd, 0);
  return {
    dueNow: Math.round(Math.max(0, due - paid) * 100) / 100,
    accruingToday: Math.round(accruing * 100) / 100,
  };
}

export function availableOrdersForDriver(state: DemoState, driverId: string): Order[] {
  const isAdmin = state.profiles.find((p) => p.id === driverId)?.role === "admin";
  const driver = state.drivers.find((d) => d.id === driverId);
  const loc = state.locations.find((l) => l.driver_id === driverId);

  // Admins see every claimable order: no type match, no freeze, no busy lock.
  if (isAdmin) {
    return state.orders.filter((o) => {
      if (o.order_type === "medical") return false;
      if (o.order_type === "long_distance" && o.status === "at_warehouse") return true;
      return o.status === "pending";
    });
  }

  if (!driver || !driver.is_online) return [];
  if (driver.banned || driver.admin_frozen) return [];
  if (state.settings.revenue_mode === "percentage") {
    if (driverCommissionTotals(state, driverId).dueNow > 0) return [];
  } else if (
    driver.subscription_status === "frozen" ||
    driver.subscription_status === "pending_payment"
  ) {
    return [];
  }

  return state.orders.filter((o) => {
    if (o.order_type === "medical") return false;
    if (o.order_type === "long_distance" && o.status === "at_warehouse") {
      return driver.driver_type === "long_distance";
    }
    if (o.status !== "pending") return false;
    if (o.order_type === "normal") return driver.driver_type === "fast";
    if (o.order_type === "long_distance") return driver.driver_type === "fast";
    if (o.order_type === "trusted") return driver.driver_type === "trusted";
    if (o.order_type === "private") return driver.driver_type === "private";
    if (o.order_type === "owner") {
      return (
        driver.driver_type === "owner" ||
        state.profiles.find((p) => p.id === driverId)?.role === "admin"
      );
    }
    return false;
  }).sort((a, b) => {
    if (!loc) return 0;
    const da = haversineKm(loc.lat, loc.lng, a.pickup_lat, a.pickup_lng);
    const db = haversineKm(loc.lat, loc.lng, b.pickup_lat, b.pickup_lng);
    return da - db;
  });
}

export function updateProfile(
  state: DemoState,
  userId: string,
  input: {
    full_name?: string;
    phone?: string;
    email?: string;
    business_name?: string;
    business_address?: string;
    business_lat?: number;
    business_lng?: number;
    avatar_url?: string;
  },
): { state: DemoState; error?: string } {
  const profile = state.profiles.find((p) => p.id === userId);
  if (!profile) return { state, error: "Profile not found" };
  if (
    input.email &&
    state.profiles.some(
      (p) => p.id !== userId && p.email.toLowerCase() === input.email!.toLowerCase(),
    )
  ) {
    return { state, error: "This email is already used" };
  }
  if (
    input.phone &&
    state.profiles.some((p) => p.id !== userId && digits(p.phone) === digits(input.phone!))
  ) {
    return { state, error: "This phone number is already used" };
  }
  const profiles = state.profiles.map((p) =>
    p.id === userId
      ? {
          ...p,
          ...(input.full_name != null ? { full_name: input.full_name } : {}),
          ...(input.phone != null ? { phone: input.phone } : {}),
          ...(input.email != null ? { email: input.email.toLowerCase() } : {}),
          ...(input.business_name != null ? { business_name: input.business_name } : {}),
          ...(input.business_address != null
            ? {
                business_address: locationLabel(
                  input.business_address,
                  input.business_lat ?? p.business_lat,
                  input.business_lng ?? p.business_lng,
                ),
              }
            : {}),
          ...(input.business_lat != null ? { business_lat: input.business_lat } : {}),
          ...(input.business_lng != null ? { business_lng: input.business_lng } : {}),
          ...(input.avatar_url != null ? { avatar_url: input.avatar_url } : {}),
        }
      : p,
  );
  return { state: { ...state, profiles } };
}

export function updateBusinessOrderCosts(
  state: DemoState,
  businessId: string,
  input: BusinessOrderCosts,
): { state: DemoState; error?: string } {
  const profile = state.profiles.find((p) => p.id === businessId);
  if (!profile || profile.role !== "business") {
    return { state, error: "Business not found" };
  }
  const costs = {
    order_min_usd: Number(input.order_min_usd),
    order_max_usd: Number(input.order_max_usd),
    order_min_lbp: roundLbp(Number(input.order_min_lbp)),
    order_max_lbp: roundLbp(Number(input.order_max_lbp)),
  };
  const err = validateBusinessOrderCosts(costs);
  if (err) return { state, error: err };
  const profiles = state.profiles.map((p) => (p.id === businessId ? { ...p, ...costs } : p));
  return { state: { ...state, profiles } };
}

export type ProfitBucket = { label: string; profit: number; orders: number };

/** Bars inside one period: 3-hour buckets for a single day, daily bars otherwise. */
export function driverDailyProfit(
  state: DemoState,
  driverId: string,
  period: "today" | "yesterday" | "week" | "month",
): ProfitBucket[] {
  const dayStart = (offset: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const completed = state.orders.filter((o) => {
    if (o.status !== "completed" && o.status !== "disputed") return false;
    if (!o.completed_at) return false;
    return o.assigned_driver_id === driverId || o.long_distance_driver_id === driverId;
  });

  const sumRange = (from: number, to: number): { profit: number; orders: number } => {
    let profit = 0;
    let orders = 0;
    for (const o of completed) {
      const t = new Date(o.completed_at!).getTime();
      if (t >= from && t < to) {
        profit += o.driver_cut_usd;
        orders += 1;
      }
    }
    return { profit: Math.round(profit * 100) / 100, orders };
  };

  if (period === "today" || period === "yesterday") {
    const start = dayStart(period === "today" ? 0 : -1);
    return Array.from({ length: 8 }, (_, i) => {
      const from = start.getTime() + i * 3 * 60 * 60 * 1000;
      const to = from + 3 * 60 * 60 * 1000;
      const hour = i * 3;
      return { label: `${String(hour).padStart(2, "0")}:00`, ...sumRange(from, to) };
    });
  }

  const days = period === "week" ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const from = dayStart(i - days + 1);
    const to = dayStart(i - days + 2);
    const label = from.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return { label, ...sumRange(from.getTime(), to.getTime()) };
  });
}

/** Client cancels their own order (only before pickup). */
export function cancelOrder(
  state: DemoState,
  orderId: string,
  clientId: string,
): { state: DemoState; error?: string } {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { state, error: "Order not found" };
  if (order.client_id !== clientId) return { state, error: "This is not your order" };
  if (!["pending", "accepted"].includes(order.status)) {
    return { state, error: "This order can no longer be cancelled" };
  }
  const orders = state.orders.map((o) =>
    o.id === orderId ? { ...o, status: "cancelled" as OrderStatus } : o,
  );
  const drivers = state.drivers.map((d) =>
    d.id === order.assigned_driver_id ? { ...d, is_busy: false } : d,
  );
  return { state: { ...state, orders, drivers } };
}

export function rejectOrder(
  state: DemoState,
  orderId: string,
): { state: DemoState; error?: string } {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { state, error: "Order not found" };
  if (!["pending", "at_warehouse"].includes(order.status)) {
    return { state, error: "Only waiting orders can be rejected" };
  }
  const orders = state.orders.map((o) =>
    o.id === orderId ? { ...o, status: "cancelled" as OrderStatus } : o,
  );
  // Free the fast driver and clear any hub product tied to this order.
  const drivers = state.drivers.map((d) =>
    d.id === order.assigned_driver_id ? { ...d, is_busy: false } : d,
  );
  const products = state.products.filter((p) => p.order_id !== orderId);
  return { state: { ...state, orders, drivers, products } };
}

export function addDriver(
  state: DemoState,
  input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    driver_type: DriverType;
  },
): { state: DemoState; error?: string } {
  if (input.driver_type === "medical") {
    return { state, error: "Medical drivers are not available yet" };
  }
  if (state.profiles.some((p) => p.email.toLowerCase() === input.email.toLowerCase())) {
    return { state, error: "This email is already used" };
  }
  if (state.profiles.some((p) => digits(p.phone) === digits(input.phone))) {
    return { state, error: "This phone number is already used" };
  }
  const id = uid();
  return {
    state: {
      ...state,
      profiles: [
        ...state.profiles,
        {
          id,
          full_name: input.full_name,
          email: input.email.toLowerCase(),
          phone: input.phone,
          password: input.password,
          role: "driver",
          created_at: new Date().toISOString(),
        },
      ],
      drivers: [
        ...state.drivers,
        {
          id,
          driver_type: input.driver_type,
          is_online: false,
          is_busy: false,
          is_trusted: input.driver_type === "trusted",
          rating_avg: 5,
          rating_count: 0,
          subscription_status: "active",
          subscription_ends_at: daysFromNow(30),
          admin_frozen: false,
          banned: false,
        },
      ],
      locations: [
        ...state.locations,
        { driver_id: id, lat: 33.8938, lng: 35.5018, updated_at: new Date().toISOString() },
      ],
    },
  };
}

export function removeDriver(
  state: DemoState,
  driverId: string,
): { state: DemoState; error?: string } {
  const hasActive = state.orders.some(
    (o) =>
      (o.assigned_driver_id === driverId || o.long_distance_driver_id === driverId) &&
      !["completed", "cancelled", "disputed"].includes(o.status),
  );
  if (hasActive) return { state, error: "This driver has an active delivery" };
  // Keep the profile so order history still shows the name.
  return {
    state: {
      ...state,
      drivers: state.drivers.filter((d) => d.id !== driverId),
      locations: state.locations.filter((l) => l.driver_id !== driverId),
      sessionUserId: state.sessionUserId === driverId ? null : state.sessionUserId,
    },
  };
}

export type DriverAccountAction = "freeze" | "unfreeze" | "ban" | "unban";

export function setDriverAccountAction(
  state: DemoState,
  driverId: string,
  action: DriverAccountAction,
): { state: DemoState; error?: string } {
  const profile = state.profiles.find((p) => p.id === driverId);
  if (profile?.role === "admin") {
    return { state, error: "Cannot freeze or ban the admin account" };
  }
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return { state, error: "Driver not found" };

  const nextFlags = {
    admin_frozen: driver.admin_frozen,
    banned: driver.banned,
    is_online: driver.is_online,
  };
  let title = "";
  let body = "";

  if (action === "freeze") {
    nextFlags.admin_frozen = true;
    nextFlags.is_online = false;
    title = "Account frozen";
    body = "An admin froze your account. You cannot take orders until they unfreeze it.";
  } else if (action === "unfreeze") {
    nextFlags.admin_frozen = false;
    title = "Account unfrozen";
    body = "An admin unfroze your account. You can go online again if your subscription is in order.";
  } else if (action === "ban") {
    nextFlags.banned = true;
    nextFlags.is_online = false;
    title = "Account banned";
    body = "Your driver account has been banned. Contact Direct if you think this is a mistake.";
  } else {
    nextFlags.banned = false;
    title = "Account reinstated";
    body = "Your ban has been lifted. You can go online again if your subscription is in order.";
  }

  return {
    state: {
      ...state,
      drivers: state.drivers.map((d) => (d.id === driverId ? { ...d, ...nextFlags } : d)),
      notifications: [
        {
          id: uid(),
          user_id: driverId,
          title,
          body,
          read: false,
          created_at: new Date().toISOString(),
        },
        ...state.notifications,
      ],
    },
  };
}

export function addWarehouse(
  state: DemoState,
  input: { name: string; address: string; lat: number; lng: number },
): DemoState {
  const warehouse: Warehouse = {
    id: uid(),
    ...input,
    address: locationLabel(input.address, input.lat, input.lng),
  };
  return { ...state, warehouses: [...state.warehouses, warehouse] };
}

export function removeWarehouse(
  state: DemoState,
  warehouseId: string,
): { state: DemoState; error?: string } {
  const inUse = state.orders.some(
    (o) =>
      o.warehouse_id === warehouseId &&
      !["completed", "cancelled", "disputed"].includes(o.status),
  );
  if (inUse) return { state, error: "An active order still goes through this warehouse" };
  return {
    state: {
      ...state,
      warehouses: state.warehouses.filter((w) => w.id !== warehouseId),
      products: state.products.filter((p) => p.warehouse_id !== warehouseId),
    },
  };
}

export function addWarehouseProduct(
  state: DemoState,
  input: { warehouse_id: string; name: string; quantity: number; note?: string },
): DemoState {
  const product: WarehouseProduct = {
    id: uid(),
    warehouse_id: input.warehouse_id,
    name: input.name,
    quantity: input.quantity,
    note: input.note ?? "",
    order_id: null,
    created_at: new Date().toISOString(),
  };
  return { ...state, products: [product, ...state.products] };
}

export function removeWarehouseProduct(state: DemoState, productId: string): DemoState {
  return { ...state, products: state.products.filter((p) => p.id !== productId) };
}

/** Selfie (if uploaded) is the driver's profile photo; otherwise `avatar_url`. */
export function profilePhotoUrl(state: DemoState, userId: string): string | undefined {
  const selfie = state.documents.find(
    (d) =>
      d.driver_id === userId &&
      d.doc_type === "selfie" &&
      d.file_data &&
      d.status !== "rejected",
  );
  if (selfie?.file_data) return selfie.file_data;
  return state.profiles.find((p) => p.id === userId)?.avatar_url;
}

/**
 * What a client/business may know about the driver on their order.
 * Admins stay invisible unless the client explicitly ordered the Direct team.
 */
export function publicDriverInfo(
  state: DemoState,
  order: Order,
): { kind: "none" | "direct" | "driver"; profile: Profile | null } {
  const driverId = order.long_distance_driver_id ?? order.assigned_driver_id;
  if (!driverId) return { kind: "none", profile: null };
  const profile = state.profiles.find((p) => p.id === driverId) ?? null;
  const isAdmin = profile?.role === "admin";
  if (order.order_type === "owner") {
    // They asked for the company — show it proudly.
    return { kind: "direct", profile };
  }
  if (isAdmin) {
    // Hide that the company itself took the order.
    return { kind: "driver", profile: null };
  }
  return { kind: "driver", profile };
}

/** Short label for client/business surfaces and map markers. */
export function publicDriverLabel(
  state: DemoState,
  order: Order,
  copy: { waiting: string; directTeam: string; yourDriver: string },
): string {
  const info = publicDriverInfo(state, order);
  if (info.kind === "none") return copy.waiting;
  if (info.kind === "direct") return copy.directTeam;
  return info.profile?.full_name ?? copy.yourDriver;
}
