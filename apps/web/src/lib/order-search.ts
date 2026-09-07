import { formatOrderNumber, type Order } from "@/lib/demo-store";

export const ORDER_SEARCH_THRESHOLD = 10;

export function orderPartyExtras(
  order: Order,
  profiles: { id: string; full_name: string; phone: string }[],
  opts?: { includeClientAlways?: boolean },
): string[] {
  const linked = Boolean(order.assigned_driver_id || order.long_distance_driver_id);
  const ids = [order.assigned_driver_id, order.long_distance_driver_id];
  if (opts?.includeClientAlways || linked) {
    ids.push(order.client_id);
  }
  return ids.flatMap((id) => {
    if (!id) return [];
    const profile = profiles.find((p) => p.id === id);
    return profile ? [profile.full_name, profile.phone] : [];
  });
}

export function filterOrdersByQuery<T extends Order>(
  orders: T[],
  query: string,
  extra?: (order: T) => string[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return orders;
  return orders.filter((order) => {
    const haystack = [
      formatOrderNumber(order.order_number),
      String(order.order_number),
      order.product_description,
      order.pickup_address,
      order.dropoff_address,
      order.status.replaceAll("_", " "),
      order.order_type,
      order.order_type.replaceAll("_", " "),
      ...(extra?.(order) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
