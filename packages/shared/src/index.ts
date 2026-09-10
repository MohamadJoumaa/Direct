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

export {
  TIMEZONE,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
  NIGHT_SURCHARGE_USD,
  WORK_DAY_START_HOUR,
  isNightShift,
  workDayStart,
  workDayRange,
} from "./beirut-time";

import { NIGHT_SURCHARGE_USD, isNightShift } from "./beirut-time";

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
  dispatch_initial_radius_km: 2,
  dispatch_radius_growth: 1.5,
  dispatch_offer_timeout_sec: 60,
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
  dispatch_initial_radius_km: number;
  dispatch_radius_growth: number;
  dispatch_offer_timeout_sec: number;
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

export type DeliveryQuote = {
  distanceKm: number;
  multiplier: number;
  baseUsd: number;
  baseLbp: number;
  nightUsd: number;
  nightLbp: number;
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
    baseUsd,
    baseLbp,
    nightUsd,
    nightLbp,
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
  return { ...quote, totalUsd, totalLbp };
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

/** Every driver can hold one active order. */
export function canAcceptAnotherOrder(
  _driverType: DriverType | undefined,
  activeCount: number,
): boolean {
  return activeCount < 1;
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

/** Rough ETA minutes from driving distance (city speed + buffer). */
export function estimateEtaMinutes(
  distanceKm: number,
  _orderType?: OrderType,
): number {
  const drive = (Math.max(0, distanceKm) / 35) * 60;
  return Math.max(5, Math.round(drive + 10));
}

export {
  DISPATCH_INITIAL_RADIUS_KM,
  DISPATCH_RADIUS_GROWTH,
  DISPATCH_OFFER_TIMEOUT_MS,
  DISPATCH_MAX_EXPAND_STEPS,
  expandDispatchRadius,
  driversInsideRadius,
  type DispatchRing,
} from "./dispatch";

export {
  WHISH_COLLECT_SUCCESS_STATUS,
  WHISH_COLLECT_CURRENCY,
  WHISH_COLLECT_CREATE_PATH,
  WHISH_COLLECT_STATUS_PATH,
  WHISH_MAX_AMOUNT_USD,
  WHISH_COLLECT_PAY_URL_KEYS,
  isWhishCollectPaid,
  parseCollectAmountUsd,
  extractCollectPayUrl,
  classifyCommissionCut,
  commissionDueNowUsd,
  isDriverPaymentBlockingWork,
  type WhishCollectKind,
} from "./payment-rules";

