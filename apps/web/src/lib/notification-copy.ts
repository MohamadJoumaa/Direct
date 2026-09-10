import { fmt, type Dictionary } from "@/lib/i18n";
import { formatOrderNumber, type Notification, type Order } from "@/lib/demo-store";

export function notificationCopy(
  n: Notification,
  dict: Dictionary,
  orders: Order[],
): { title: string; body: string; href?: string } {
  if (n.kind === "order_offered") {
    const order = n.order_id ? orders.find((o) => o.id === n.order_id) : undefined;
    const number = order ? formatOrderNumber(order.order_number) : "";
    return {
      title: dict.driver.orderOfferedTitle,
      body: number
        ? fmt(dict.driver.orderOfferedBody, { number })
        : dict.driver.orderOfferedTitle,
      href: n.order_id ? `/app/driver/orders/${n.order_id}` : "/app/driver",
    };
  }
  if (n.kind === "order_cancelled") {
    const order = n.order_id ? orders.find((o) => o.id === n.order_id) : undefined;
    const number = order ? formatOrderNumber(order.order_number) : "";
    return {
      title: dict.driver.orderCancelledTitle,
      body: number
        ? fmt(dict.driver.orderCancelledBody, { number })
        : dict.driver.orderCancelledBodyFallback,
      href: n.order_id ? `/app/driver/orders/${n.order_id}` : undefined,
    };
  }
  return { title: n.title, body: n.body };
}
