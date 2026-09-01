import { z } from "zod";

export const USER_ROLES = ["admin", "client", "business", "driver"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DRIVER_TYPES = [
  "fast",
  "long_distance",
  "trusted",
  "private",
  "owner",
  "medical",
] as const;
export type DriverType = (typeof DRIVER_TYPES)[number];

/** Public driver types in Phase 1 (medical hidden). */
export const PUBLIC_DRIVER_TYPES = DRIVER_TYPES.filter((t) => t !== "medical");

export const ORDER_TYPES = [
  "normal",
  "long_distance",
  "trusted",
  "private",
  "owner",
  "medical",
] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PUBLIC_ORDER_TYPES = ORDER_TYPES.filter((t) => t !== "medical");

export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "arrived",
  "awaiting_confirmation",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REVENUE_MODES = ["subscription", "percentage"] as const;
export type RevenueMode = (typeof REVENUE_MODES)[number];

export const WHISH_NUMBER = "81848663";
export const TIMEZONE = "Asia/Beirut";

/** Night shift: 00:00–06:00 local (Asia/Beirut). */
export const NIGHT_START_HOUR = 0;
export const NIGHT_END_HOUR = 6;
export const NIGHT_SURCHARGE_USD = 1;

/** Commission work day starts at 07:00 Beirut (independent of night end). */
export const WORK_DAY_START_HOUR = 7;

export const DEFAULT_SETTINGS = {
  revenue_mode: "subscription" as RevenueMode,
  subscription_price_usd: 20,
  grace_days: 5,
  freeze_penalty_usd: 10,
  company_percentage: 15,
  night_surcharge_usd: NIGHT_SURCHARGE_USD,
  night_surcharge_lbp: 89_000,
  whish_number: WHISH_NUMBER,
  /** Flat min fare applies from 0 km up to this distance. */
  fare_min_km: 3,
  /** Fare reaches the max at this distance and stays there beyond it. */
  fare_max_km: 150,
  fare_min_usd: 2.24,
  fare_max_usd: 10,
  fare_min_lbp: 200_000,
  fare_max_lbp: 890_000,
  multiplier_normal: 1,
  multiplier_long_distance: 1.1,
  multiplier_trusted: 1.4,
  multiplier_private: 3.5,
  multiplier_owner: 1.2,
  multiplier_medical: 2,
  nearby_radius_km: 15,
} as const;

export type CompanySettings = {
  revenue_mode: RevenueMode;
  subscription_price_usd: number;
  grace_days: number;
  freeze_penalty_usd: number;
  company_percentage: number;
  night_surcharge_usd: number;
  night_surcharge_lbp: number;
  whish_number: string;
  fare_min_km: number;
  fare_max_km: number;
  fare_min_usd: number;
  fare_max_usd: number;
  fare_min_lbp: number;
  fare_max_lbp: number;
  multiplier_normal: number;
  multiplier_long_distance: number;
  multiplier_trusted: number;
  multiplier_private: number;
  multiplier_owner: number;
  multiplier_medical: number;
  nearby_radius_km: number;
};

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Cash LBP is quoted in thousands. */
export function roundLbp(n: number): number {
  return Math.round(n / 1000) * 1000;
}

export function formatLbp(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} LBP`;
}

export function formatDeliveryCash(usd: number, lbp?: number | null): string {
  const usdPart = `$${usd.toFixed(2)}`;
  if (lbp == null || Number.isNaN(lbp)) return usdPart;
  return `${usdPart} · ${formatLbp(lbp)}`;
}

/**
 * Piecewise fare: min price from 0→minKm, linear to maxKm, then cap at max.
 * USD and LBP bands are independent so admin can set each currency freely.
 */
export function interpolateFare(
  distanceKm: number,
  minKm: number,
  maxKm: number,
  minFare: number,
  maxFare: number,
): number {
  const d = Math.max(0, distanceKm);
  const lo = Math.max(0, minKm);
  const hi = Math.max(lo, maxKm);
  if (d <= lo) return minFare;
  if (hi === lo || d >= hi) return maxFare;
  const t = (d - lo) / (hi - lo);
  return minFare + t * (maxFare - minFare);
}

export function multiplierForType(
  type: OrderType,
  settings: Pick<
    CompanySettings,
    | "multiplier_normal"
    | "multiplier_long_distance"
    | "multiplier_trusted"
    | "multiplier_private"
    | "multiplier_owner"
    | "multiplier_medical"
  >,
): number {
  switch (type) {
    case "normal":
      return settings.multiplier_normal;
    case "long_distance":
      return settings.multiplier_long_distance;
    case "trusted":
      return settings.multiplier_trusted;
    case "private":
      return settings.multiplier_private;
    case "owner":
      return settings.multiplier_owner;
    case "medical":
      return settings.multiplier_medical;
    default:
      return settings.multiplier_normal;
  }
}

type BeirutParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function beirutParts(date: Date): BeirutParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function tzOffsetMs(instant: Date): number {
  const p = beirutParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

function beirutCivilToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  const first = asUtc - tzOffsetMs(new Date(asUtc));
  return new Date(asUtc - tzOffsetMs(new Date(first)));
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** Beirut local hour 0–5 inclusive → night surcharge (12am–6am). */
export function isNightShift(date: Date = new Date()): boolean {
  const hour = beirutParts(date).hour;
  return hour >= NIGHT_START_HOUR && hour < NIGHT_END_HOUR;
}

/** Start of the current 07:00→07:00 Beirut work day. */
export function workDayStart(at: Date = new Date()): Date {
  const p = beirutParts(at);
  const day =
    p.hour < WORK_DAY_START_HOUR
      ? addCalendarDays(p.year, p.month, p.day, -1)
      : { year: p.year, month: p.month, day: p.day };
  return beirutCivilToUtc(day.year, day.month, day.day, WORK_DAY_START_HOUR);
}

export function workDayRange(at: Date = new Date()): { start: Date; end: Date } {
  const start = workDayStart(at);
  const p = beirutParts(start);
  const next = addCalendarDays(p.year, p.month, p.day, 1);
  const end = beirutCivilToUtc(next.year, next.month, next.day, WORK_DAY_START_HOUR);
  return { start, end };
}

export type DeliveryQuote = {
  distanceKm: number;
  multiplier: number;
  base: number;
  baseUsd: number;
  baseLbp: number;
  night: number;
  nightUsd: number;
  nightLbp: number;
  total: number;
  totalUsd: number;
  totalLbp: number;
};

export function quoteDeliveryPrice(
  type: OrderType,
  settings: CompanySettings,
  distanceKm: number,
  at: Date = new Date(),
): DeliveryQuote {
  const multiplier = Math.max(0, multiplierForType(type, settings));
  const distance = Math.max(0, distanceKm);
  const bandUsd = interpolateFare(
    distance,
    settings.fare_min_km,
    settings.fare_max_km,
    settings.fare_min_usd,
    settings.fare_max_usd,
  );
  const bandLbp = interpolateFare(
    distance,
    settings.fare_min_km,
    settings.fare_max_km,
    settings.fare_min_lbp,
    settings.fare_max_lbp,
  );
  const baseUsd = roundUsd(bandUsd * multiplier);
  const baseLbp = roundLbp(bandLbp * multiplier);
  const nightUsd = isNightShift(at) ? settings.night_surcharge_usd : 0;
  const nightLbp = isNightShift(at) ? settings.night_surcharge_lbp : 0;
  const totalUsd = roundUsd(baseUsd + nightUsd);
  const totalLbp = roundLbp(baseLbp + nightLbp);
  return {
    distanceKm: distance,
    multiplier,
    base: baseUsd,
    baseUsd,
    baseLbp,
    night: nightUsd,
    nightUsd,
    nightLbp,
    total: totalUsd,
    totalUsd,
    totalLbp,
  };
}

/** Per-business floor and ceiling for a single order (admin-set). */
export type BusinessOrderCosts = {
  order_min_usd: number;
  order_max_usd: number;
  order_min_lbp: number;
  order_max_lbp: number;
};

export const DEFAULT_BUSINESS_ORDER_COSTS: BusinessOrderCosts = {
  order_min_usd: DEFAULT_SETTINGS.fare_min_usd,
  order_max_usd: DEFAULT_SETTINGS.fare_max_usd,
  order_min_lbp: DEFAULT_SETTINGS.fare_min_lbp,
  order_max_lbp: DEFAULT_SETTINGS.fare_max_lbp,
};

export function validateBusinessOrderCosts(
  costs: BusinessOrderCosts,
): string | null {
  const values = [
    costs.order_min_usd,
    costs.order_max_usd,
    costs.order_min_lbp,
    costs.order_max_lbp,
  ];
  if (values.some((n) => !Number.isFinite(n) || n < 0)) {
    return "Costs must be zero or more";
  }
  if (costs.order_min_usd > costs.order_max_usd) {
    return "Minimum $ cannot be higher than maximum $";
  }
  if (costs.order_min_lbp > costs.order_max_lbp) {
    return "Minimum LBP cannot be higher than maximum LBP";
  }
  return null;
}

export function withBusinessOrderCosts(
  profile: Partial<BusinessOrderCosts> | null | undefined,
): BusinessOrderCosts {
  return {
    order_min_usd: profile?.order_min_usd ?? DEFAULT_BUSINESS_ORDER_COSTS.order_min_usd,
    order_max_usd: profile?.order_max_usd ?? DEFAULT_BUSINESS_ORDER_COSTS.order_max_usd,
    order_min_lbp: profile?.order_min_lbp ?? DEFAULT_BUSINESS_ORDER_COSTS.order_min_lbp,
    order_max_lbp: profile?.order_max_lbp ?? DEFAULT_BUSINESS_ORDER_COSTS.order_max_lbp,
  };
}

/** Keep the quoted cash inside this business's admin-set range. */
export function clampQuoteToBusinessCosts(
  quote: DeliveryQuote,
  costs: BusinessOrderCosts,
): DeliveryQuote {
  const totalUsd = roundUsd(
    Math.min(costs.order_max_usd, Math.max(costs.order_min_usd, quote.totalUsd)),
  );
  const totalLbp = roundLbp(
    Math.min(costs.order_max_lbp, Math.max(costs.order_min_lbp, quote.totalLbp)),
  );
  return { ...quote, total: totalUsd, totalUsd, totalLbp };
}

/** Percentage applies to base only; night surcharge stays with the driver. */
export function splitRevenue(
  deliveryFee: number,
  settings: CompanySettings,
  baseFee: number = deliveryFee,
): { company_cut: number; driver_cut: number } {
  if (settings.revenue_mode === "percentage") {
    const company_cut =
      Math.round(baseFee * (settings.company_percentage / 100) * 100) / 100;
    return {
      company_cut,
      driver_cut: Math.round((deliveryFee - company_cut) * 100) / 100,
    };
  }
  return { company_cut: 0, driver_cut: deliveryFee };
}

/** Fast drivers: one active order. Long-distance: can take more. */
export function canAcceptAnotherOrder(
  driverType: DriverType,
  activeCount: number,
): boolean {
  if (driverType === "fast") return activeCount < 1;
  if (driverType === "long_distance") return true;
  return activeCount < 1;
}

export function driverTypeForOrder(orderType: OrderType): DriverType | "admin" {
  switch (orderType) {
    case "normal":
      return "fast";
    case "long_distance":
      return "fast";
    case "trusted":
      return "trusted";
    case "private":
      return "private";
    case "owner":
      return "admin";
    case "medical":
      return "medical";
    default:
      return "fast";
  }
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  normal: "Fast delivery",
  long_distance: "Long distance",
  trusted: "Trusted driver",
  private: "Private driver",
  owner: "Direct team",
  medical: "Medical (soon)",
};

export const DRIVER_TYPE_LABELS: Record<DriverType, string> = {
  fast: "Fast driver",
  long_distance: "Long distance",
  trusted: "Trusted driver",
  private: "Private driver",
  owner: "Direct team",
  medical: "Medical driver",
};

export const registerSchema = z
  .object({
    full_name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    phone: z
      .string()
      .min(8, "Enter a valid phone number")
      .regex(/^[0-9+\s-]+$/, "Phone can only contain numbers"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string(),
    role: z.enum(["client", "business", "driver"]),
    business_name: z.string().optional(),
    business_address: z.string().optional(),
    business_lat: z.number().optional(),
    business_lng: z.number().optional(),
    driver_type: z.enum(DRIVER_TYPES).optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords must match",
    path: ["confirm_password"],
  })
  .refine((d) => d.role !== "business" || (d.business_name && d.business_name.length >= 2), {
    message: "Enter your business name",
    path: ["business_name"],
  })
  .refine(
    (d) =>
      d.role !== "business" ||
      (d.business_address &&
        d.business_address.length >= 3 &&
        typeof d.business_lat === "number" &&
        typeof d.business_lng === "number"),
    {
      message: "Pin your shop on the map",
      path: ["business_address"],
    },
  )
  .refine((d) => d.role !== "driver" || !!d.driver_type, {
    message: "Choose a driver type",
    path: ["driver_type"],
  });

export const loginSchema = z.object({
  identifier: z.string().min(3, "Enter email or phone"),
  password: z.string().min(1, "Enter your password"),
});

export const createOrderSchema = z.object({
  pickup_address: z.string().min(3, "Where should we pick up?"),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  dropoff_address: z.string().min(3, "Where should we deliver?"),
  dropoff_lat: z.number(),
  dropoff_lng: z.number(),
  product_description: z.string().min(2, "What are we delivering?"),
  order_type: z.enum(PUBLIC_ORDER_TYPES as unknown as [OrderType, ...OrderType[]]),
});

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rough ETA minutes from distance + type buffer. */
export function estimateEtaMinutes(
  distanceKm: number,
  orderType: OrderType,
): number {
  const speedKmh = orderType === "long_distance" ? 60 : 35;
  const drive = (distanceKm / speedKmh) * 60;
  const buffer =
    orderType === "long_distance" ? 45 : orderType === "private" ? 15 : 10;
  return Math.max(5, Math.round(drive + buffer));
}
