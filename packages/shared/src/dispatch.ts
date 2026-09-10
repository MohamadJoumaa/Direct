export const DISPATCH_INITIAL_RADIUS_KM = 2;
export const DISPATCH_RADIUS_GROWTH = 1.5;
export const DISPATCH_OFFER_TIMEOUT_MS = 60_000;
export const DISPATCH_MAX_EXPAND_STEPS = 40;

export type DispatchRing = {
  radiusKm: number;
  driverCount: number;
};

/**
 * Grow radius from 2 km by ×1.5 until at least one driver is inside,
 * or return null when there are no candidates.
 */
export function expandDispatchRadius(
  toPickupKm: number[],
  initialRadiusKm: number = DISPATCH_INITIAL_RADIUS_KM,
  growth: number = DISPATCH_RADIUS_GROWTH,
): DispatchRing | null {
  if (toPickupKm.length === 0) return null;
  const distances = toPickupKm.filter((km) => Number.isFinite(km) && km >= 0);
  if (distances.length === 0) return null;

  const start = Math.max(0.001, initialRadiusKm);
  const factor = growth > 1 ? growth : DISPATCH_RADIUS_GROWTH;
  let radius = start;

  for (let step = 0; step < DISPATCH_MAX_EXPAND_STEPS; step += 1) {
    const driverCount = distances.filter((km) => km <= radius).length;
    if (driverCount > 0) return { radiusKm: radius, driverCount };
    radius *= factor;
  }

  const nearest = Math.min(...distances);
  return { radiusKm: nearest, driverCount: 1 };
}

export function driversInsideRadius(
  legs: { driverId: string; toPickupKm: number; toDropoffKm: number }[],
  radiusKm: number,
): typeof legs {
  return legs
    .filter((leg) => Number.isFinite(leg.toPickupKm) && leg.toPickupKm <= radiusKm)
    .toSorted((a, b) => {
      const pickup = a.toPickupKm - b.toPickupKm;
      if (pickup !== 0) return pickup;
      return a.toDropoffKm - b.toDropoffKm;
    });
}
