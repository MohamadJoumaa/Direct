/**
 * Straight-line km between two points.
 *
 * A local copy of `haversineKm` rather than an import from the barrel: the
 * barrel re-exports this module, so importing a *value* back out of it is a
 * real require cycle — `route-plan.ts` and `dispatch.ts` stay dependency-free
 * for the same reason. Type-only imports from `./index` are fine (they are
 * erased); values are not.
 */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

/**
 * Advancing a delivery from the driver's position instead of their thumb.
 *
 * A driver on a scooter in traffic should not be tapping through four status
 * buttons, and the taps they do make are the least reliable data in the system:
 * they happen late, in batches, or at the end of the run from memory. Their GPS
 * fix does not have that problem — it is already being written every few
 * seconds so the client can watch the delivery.
 *
 * What this deliberately does **not** do is confirm the delivery. Standing at
 * the drop-off address proves the driver got there; it says nothing about the
 * package changing hands, and `confirmDelivery` needs both sides for a reason.
 * So the last automatic step is `arrived`, and the handshake stays manual.
 *
 * Pure, and in `@direct/shared`, so the website and Expo advance orders on
 * exactly the same rule — a status that appears on one client and not the
 * other is the kind of bug a client sees before we do.
 */

/** Inside this distance of a stop, the driver counts as being at it. */
export const GEOFENCE_RADIUS_KM = 0.12;

/**
 * And this far away, they have left it.
 *
 * Wider than the arrival radius on purpose: one hysteresis band, so a fix that
 * jitters across the boundary — which every phone's does, especially between
 * buildings — cannot flip a status back and forth. Nothing advances in the gap.
 */
export const GEOFENCE_EXIT_KM = 0.25;

export type AutoStatusAction = "picked_up" | "in_transit" | "arrived";

export type AutoStatusInput = {
  status: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  driver: { lat: number; lng: number } | null | undefined;
  /** Long-distance orders hand off at a hub; they are left alone here. */
  isLongDistance?: boolean;
};

/**
 * The step this order should take right now, or null to leave it alone.
 *
 * One step per call by design: the caller re-runs it on the next position
 * update, so a driver who is somehow already at the drop-off still walks
 * through picked_up → in_transit → arrived in order, and every transition is
 * recorded rather than skipped.
 */
export function nextAutoStatus(input: AutoStatusInput): AutoStatusAction | null {
  const { status, pickup, dropoff, driver, isLongDistance } = input;
  if (!driver) return null;
  if (!Number.isFinite(driver.lat) || !Number.isFinite(driver.lng)) return null;

  // The warehouse hop has its own hand-off, with a second driver and a shelf
  // record. Automating half of that would strand the package.
  if (isLongDistance) return null;

  const toPickup = distanceKm(driver.lat, driver.lng, pickup.lat, pickup.lng);
  const toDropoff = distanceKm(driver.lat, driver.lng, dropoff.lat, dropoff.lng);

  switch (status) {
    case "accepted":
      return toPickup <= GEOFENCE_RADIUS_KM ? "picked_up" : null;
    case "picked_up":
      // Leaving the pickup is what "in transit" means. Requiring the exit band
      // rather than the arrival one keeps a driver waiting at the shop from
      // flickering between the two.
      return toPickup > GEOFENCE_EXIT_KM ? "in_transit" : null;
    case "in_transit":
      return toDropoff <= GEOFENCE_RADIUS_KM ? "arrived" : null;
    default:
      return null;
  }
}

/**
 * Whether pickup and drop-off are too close together to tell apart.
 *
 * Under two geofence radii the two zones overlap, and a single fix would
 * satisfy both — the order would run itself from accepted to arrived without
 * the driver moving. Such an order stays manual.
 */
export function stopsAreDistinguishable(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): boolean {
  return distanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) > GEOFENCE_EXIT_KM * 2;
}
