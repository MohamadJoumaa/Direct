import { sequenceStops, type LatLng, type RouteStop } from "@direct/shared";
import type { DemoState } from "./store";

const PRE_PICKUP = new Set(["pending", "accepted"]);

/** Warms whatever distance source the client has, then answers synchronously. */
export type PrepareDistances = (
  points: LatLng[],
) => Promise<(a: LatLng, b: LatLng) => number>;

/**
 * Sequenced stops for every active order this driver holds: a pickup stop only
 * while the order has not been picked up yet, and always a drop-off, starting
 * from the driver's live fix.
 *
 * Pickup-before-dropoff is enforced by `sequenceStops`. Google's
 * `optimizeWaypoints` is deliberately not used anywhere in the product — it
 * reorders freely and would happily schedule a drop-off before its own pickup.
 *
 * The distance source is injected because the two clients measure differently
 * (Maps JS on the web, the Distance Matrix REST API in Expo) while the
 * sequencing itself must stay identical.
 */
export async function buildDriverRoute(
  state: DemoState,
  driverId: string,
  prepare: PrepareDistances,
): Promise<RouteStop[]> {
  const orders = state.orders.filter(
    (o) =>
      (o.assigned_driver_id === driverId || o.long_distance_driver_id === driverId) &&
      !["completed", "cancelled"].includes(o.status),
  );
  if (orders.length === 0) return [];

  const stops: RouteStop[] = [];
  for (const o of orders) {
    if (PRE_PICKUP.has(o.status)) {
      stops.push({
        id: `${o.id}-pickup`,
        orderId: o.id,
        kind: "pickup",
        lat: o.pickup_lat,
        lng: o.pickup_lng,
      });
    }
    stops.push({
      id: `${o.id}-dropoff`,
      orderId: o.id,
      kind: "dropoff",
      lat: o.dropoff_lat,
      lng: o.dropoff_lng,
    });
  }
  if (stops.length === 0) return [];

  const liveLoc = state.locations.find((l) => l.driver_id === driverId);
  const start = liveLoc
    ? { lat: liveLoc.lat, lng: liveLoc.lng }
    : { lat: stops[0].lat, lng: stops[0].lng };

  const distance = await prepare([start, ...stops.map((s) => ({ lat: s.lat, lng: s.lng }))]);
  return sequenceStops(start, stops, distance);
}
