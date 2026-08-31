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
  whish_number: WHISH_NUMBER,
  price_normal_usd: 3,
  price_long_distance_usd: 8,
  price_trusted_usd: 5,
  price_private_usd: 25,
  price_owner_usd: 4,
  price_medical_usd: 10,
  nearby_radius_km: 15,
} as const;

export type CompanySettings = {
  revenue_mode: RevenueMode;
  subscription_price_usd: number;
  grace_days: number;
  freeze_penalty_usd: number;
  company_percentage: number;
  night_surcharge_usd: number;
  whish_number: string;
  price_normal_usd: number;
  price_long_distance_usd: number;
  price_trusted_usd: number;
  price_private_usd: number;
  price_owner_usd: number;
  price_medical_usd: number;
  nearby_radius_km: number;
};

export function basePriceForType(
  type: OrderType,
  settings: Pick<
    CompanySettings,
    | "price_normal_usd"
    | "price_long_distance_usd"
    | "price_trusted_usd"
    | "price_private_usd"
    | "price_owner_usd"
    | "price_medical_usd"
  >,
): number {
  switch (type) {
    case "normal":
      return settings.price_normal_usd;
    case "long_distance":
      return settings.price_long_distance_usd;
    case "trusted":
      return settings.price_trusted_usd;
    case "private":
      return settings.price_private_usd;
    case "owner":
      return settings.price_owner_usd;
    case "medical":
      return settings.price_medical_usd;
    default:
      return settings.price_normal_usd;
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

export function quoteDeliveryPrice(
  type: OrderType,
  settings: CompanySettings,
  at: Date = new Date(),
): { base: number; night: number; total: number } {
  const base = basePriceForType(type, settings);
  const night = isNightShift(at) ? settings.night_surcharge_usd : 0;
  return { base, night, total: base + night };
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
