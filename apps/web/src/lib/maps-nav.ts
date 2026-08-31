import type { Order, Warehouse } from "@/lib/demo-store";

export type LatLng = { lat: number; lng: number };

export type NavKind = "pickup" | "dropoff" | "warehouse";

export type NavStop = LatLng & { kind: NavKind };

const PRE_PICKUP = new Set(["pending", "accepted"]);

/** Driver currently responsible for movement — none while waiting at the hub. */
export function activeDriverId(order: Order): string | null {
  if (order.status === "pending" || order.status === "at_warehouse") return null;
  if (
    order.order_type === "long_distance" &&
    (order.status === "in_transit" ||
      order.status === "arrived" ||
      order.status === "awaiting_confirmation")
  ) {
    return order.long_distance_driver_id;
  }
  if (order.status === "accepted" || order.status === "picked_up") {
    return order.assigned_driver_id;
  }
  return order.long_distance_driver_id ?? order.assigned_driver_id;
}

/** Next stop for in-app routing and Google Maps navigation. */
export function nextNavStop(
  order: Pick<
    Order,
    | "status"
    | "order_type"
    | "pickup_lat"
    | "pickup_lng"
    | "dropoff_lat"
    | "dropoff_lng"
  >,
  warehouse?: Pick<Warehouse, "lat" | "lng"> | null,
): NavStop {
  const pickup: NavStop = { lat: order.pickup_lat, lng: order.pickup_lng, kind: "pickup" };
  const dropoff: NavStop = { lat: order.dropoff_lat, lng: order.dropoff_lng, kind: "dropoff" };

  if (PRE_PICKUP.has(order.status)) return pickup;

  if (order.order_type === "long_distance" && order.status === "picked_up" && warehouse) {
    return { lat: warehouse.lat, lng: warehouse.lng, kind: "warehouse" };
  }

  return dropoff;
}

/** Polyline for client tracking: live driver → next stop, or pickup → drop-off. */
export function trackingRoute(
  order: Pick<
    Order,
    | "status"
    | "order_type"
    | "pickup_lat"
    | "pickup_lng"
    | "dropoff_lat"
    | "dropoff_lng"
  >,
  live: LatLng | null,
  warehouse?: Pick<Warehouse, "lat" | "lng"> | null,
): LatLng[] {
  if (live) {
    const next = nextNavStop(order, warehouse);
    return [live, { lat: next.lat, lng: next.lng }];
  }
  return [
    { lat: order.pickup_lat, lng: order.pickup_lng },
    ...(warehouse && order.order_type === "long_distance"
      ? [{ lat: warehouse.lat, lng: warehouse.lng }]
      : []),
    { lat: order.dropoff_lat, lng: order.dropoff_lng },
  ];
}

export function openDrivingDirections(dest: LatLng) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function shortProduct(text: string, max = 22): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}
