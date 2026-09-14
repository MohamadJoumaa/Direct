import { notificationCopy as sharedCopy } from "@direct/i18n";
import type { Dictionary } from "@/lib/i18n";
import { formatOrderNumber, type Notification, type Order } from "@/lib/demo-store";

/**
 * Web binding for the shared notification copy. The dictionary lookup lives in
 * `@direct/i18n` so Expo renders the identical strings; only the destination
 * differs, because the two route tables do.
 */
export function notificationCopy(
  n: Notification,
  dict: Dictionary,
  orders: Order[],
): { title: string; body: string; href?: string } {
  const copy = sharedCopy(n, dict, (orderId) => {
    const order = orderId ? orders.find((o) => o.id === orderId) : undefined;
    return order ? formatOrderNumber(order.order_number) : "";
  });

  if (n.kind === "order_offered") {
    return { ...copy, href: n.order_id ? `/app/driver/orders/${n.order_id}` : "/app/driver" };
  }
  if (n.kind === "order_cancelled") {
    return { ...copy, href: n.order_id ? `/app/driver/orders/${n.order_id}` : undefined };
  }
  if (n.kind === "docs_approved") {
    return { ...copy, href: "/app/profile" };
  }
  return copy;
}
