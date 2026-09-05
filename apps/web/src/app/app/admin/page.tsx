"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDeliveryCash, ORDER_TYPE_LABELS } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import type { Order } from "@/lib/demo-store";
import { formatOrderNumber } from "@/lib/demo-store";

function orderDriverId(order: Order) {
  return order.long_distance_driver_id ?? order.assigned_driver_id;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { state, claimOrder, rejectOrder } = useStore();
  const { dict } = useI18n();

  if (!user || !isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  const pending = state.orders.filter((o) => o.status === "pending" || o.status === "at_warehouse");
  const ongoing = state.orders.filter(
    (o) => !["pending", "completed", "cancelled", "disputed", "at_warehouse"].includes(o.status),
  );
  const history = state.orders.filter((o) =>
    ["completed", "cancelled", "disputed"].includes(o.status),
  );

  function detailsLink(orderId: string) {
    return (
      <Link
        href={`/app/admin/orders/${orderId}`}
        className="touch-target inline-flex items-center rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-muted"
      >
        {dict.admin.details}
      </Link>
    );
  }

  return (
    <AppShell title="Admin">
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="heading-easy">{dict.admin.allOrders}</h1>
          <LinkButton href="/app/client/new" size="lg" className="touch-target rounded-full">
            {dict.nav.newOrder}
          </LinkButton>
        </div>

        <OrdersTable
          title={dict.admin.pendingOrders}
          empty={dict.admin.noPending}
          orders={pending}
          profiles={state.profiles}
          headers={{
            number: dict.common.orderNumber,
            item: dict.common.item,
            type: dict.common.type,
            driver: dict.common.driver,
            status: dict.common.status,
            fee: dict.common.fee,
          }}
          actions={(o) => (
            <div className="flex flex-wrap justify-end gap-2">
              {detailsLink(o.id)}
              <Button
                size="sm"
                className="touch-target"
                onClick={() => {
                  const err = claimOrder(o.id, user.id);
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  router.push(`/app/admin/orders/${o.id}`);
                }}
              >
                {dict.admin.takeOrder}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="touch-target"
                onClick={() => {
                  const err = rejectOrder(o.id);
                  if (err) toast.error(err);
                  else toast.success(dict.admin.rejectedToast);
                }}
              >
                {dict.admin.reject}
              </Button>
            </div>
          )}
        />

        <OrdersTable
          title={dict.admin.ongoingOrders}
          empty={dict.admin.noOngoing}
          orders={ongoing}
          profiles={state.profiles}
          headers={{
            number: dict.common.orderNumber,
            item: dict.common.item,
            type: dict.common.type,
            driver: dict.common.driver,
            status: dict.common.status,
            fee: dict.common.fee,
          }}
          actions={(o) => <div className="text-end">{detailsLink(o.id)}</div>}
        />

        <OrdersTable
          title={dict.admin.historyOrders}
          empty={dict.admin.noHistory}
          orders={history}
          profiles={state.profiles}
          headers={{
            number: dict.common.orderNumber,
            item: dict.common.item,
            type: dict.common.type,
            driver: dict.common.driver,
            status: dict.common.status,
            fee: dict.common.fee,
          }}
          actions={(o) => <div className="text-end">{detailsLink(o.id)}</div>}
        />
      </div>
    </AppShell>
  );
}

function OrdersTable({
  title,
  empty,
  orders,
  profiles,
  headers,
  actions,
}: {
  title: string;
  empty: string;
  orders: Order[];
  profiles: { id: string; full_name: string; phone: string }[];
  headers: { number: string; item: string; type: string; driver: string; status: string; fee: string };
  actions: (order: Order) => ReactNode;
}) {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{headers.number}</TableHead>
              <TableHead>{headers.item}</TableHead>
              <TableHead>{headers.type}</TableHead>
              <TableHead>{headers.driver}</TableHead>
              <TableHead>{headers.status}</TableHead>
              <TableHead>{headers.fee}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const driverId = orderDriverId(o);
              const driver = driverId ? profiles.find((p) => p.id === driverId) : null;
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-base font-semibold tabular-nums">
                    {formatOrderNumber(o.order_number)}
                  </TableCell>
                  <TableCell className="text-base">{o.product_description}</TableCell>
                  <TableCell>
                    <Badge>{ORDER_TYPE_LABELS[o.order_type]}</Badge>
                  </TableCell>
                  <TableCell className="text-base">
                    {driver?.full_name ?? "—"}
                    <br />
                    <span className="text-muted-foreground">{driver?.phone}</span>
                  </TableCell>
                  <TableCell className="capitalize">{o.status.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    {formatDeliveryCash(o.delivery_fee_usd, o.delivery_fee_lbp)}
                  </TableCell>
                  <TableCell>{actions(o)}</TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
