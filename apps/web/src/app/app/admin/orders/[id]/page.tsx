"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { formatDeliveryCash, ORDER_TYPE_LABELS } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { DeliveryMap } from "@/components/delivery-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { state, claimOrder, advanceOrder, confirmDelivery, rejectOrder } = useStore();
  const { dict } = useI18n();

  const order = state.orders.find((o) => o.id === params.id);
  if (!user || !isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }
  if (!order) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.orderNotFound}</p>
      </AppShell>
    );
  }

  const client = state.profiles.find((p) => p.id === order.client_id);
  const driverId = order.long_distance_driver_id ?? order.assigned_driver_id;
  const driverProfile = driverId ? state.profiles.find((p) => p.id === driverId) : null;
  const warehouse = order.warehouse_id
    ? state.warehouses.find((w) => w.id === order.warehouse_id)
    : null;
  const adminIsDriver = driverId === user.id;
  const claimable =
    order.status === "pending" ||
    (order.status === "at_warehouse" && order.order_type === "long_distance");

  return (
    <AppShell title={dict.admin.orderDetail}>
      <div className="flex flex-col gap-6">
        <Link
          href="/app/admin"
          className="touch-target inline-flex w-fit items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {dict.admin.allOrders}
        </Link>

        <Card className="border-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-2xl">{order.product_description}</CardTitle>
            <Badge className="text-sm">{ORDER_TYPE_LABELS[order.order_type]}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-lg">
            <p>
              <strong>{dict.common.status}:</strong>{" "}
              <span className="capitalize">{order.status.replaceAll("_", " ")}</span>
            </p>
            <p>
              <strong>{dict.common.from}:</strong> {order.pickup_address}
            </p>
            <p>
              <strong>{dict.common.to}:</strong> {order.dropoff_address}
            </p>
            {warehouse ? (
              <p>
                <strong>{dict.nav.warehouses}:</strong> {warehouse.name} — {warehouse.address}
              </p>
            ) : null}
            <p>
              <strong>{dict.common.client}:</strong> {client?.full_name} · {client?.phone}
            </p>
            <p>
              <strong>{dict.common.driver}:</strong>{" "}
              {driverProfile
                ? `${driverProfile.full_name}${adminIsDriver ? " (you)" : ""} · ${driverProfile.phone}`
                : "—"}
            </p>
            <p>
              <strong>{dict.common.fee}:</strong>{" "}
              {formatDeliveryCash(order.delivery_fee_usd, order.delivery_fee_lbp)} (driver $
              {order.driver_cut_usd.toFixed(2)} / company ${order.company_cut_usd.toFixed(2)})
            </p>
            {order.eta_minutes ? (
              <p>
                <strong>{dict.common.eta}:</strong> ~{order.eta_minutes} {dict.common.minutes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {claimable ? (
              <>
                <Button
                  size="lg"
                  className="touch-target rounded-full"
                  onClick={() => {
                    const err = claimOrder(order.id, user.id);
                    if (err) toast.error(err);
                    else toast.success("Order is yours");
                  }}
                >
                  {dict.admin.takeOrder}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="touch-target rounded-full"
                  onClick={() => {
                    const err = rejectOrder(order.id);
                    if (err) {
                      toast.error(err);
                      return;
                    }
                    toast.success(dict.admin.rejectedToast);
                    router.push("/app/admin");
                  }}
                >
                  {dict.admin.reject}
                </Button>
              </>
            ) : null}

            {adminIsDriver && order.status === "accepted" ? (
              <Button
                size="lg"
                className="touch-target rounded-full"
                onClick={() => {
                  const err = advanceOrder(order.id, user.id, "picked_up");
                  if (err) toast.error(err);
                }}
              >
                Picked up
              </Button>
            ) : null}
            {adminIsDriver &&
            order.order_type === "long_distance" &&
            ["accepted", "picked_up"].includes(order.status) ? (
              <Button
                size="lg"
                variant="outline"
                className="touch-target rounded-full"
                onClick={() => {
                  const err = advanceOrder(order.id, user.id, "at_warehouse");
                  if (err) toast.error(err);
                  else toast.success("At warehouse");
                }}
              >
                Arrived at warehouse
              </Button>
            ) : null}
            {adminIsDriver && ["picked_up", "accepted"].includes(order.status) ? (
              <Button
                size="lg"
                variant="outline"
                className="touch-target rounded-full"
                onClick={() => {
                  const err = advanceOrder(order.id, user.id, "in_transit");
                  if (err) toast.error(err);
                }}
              >
                On the way
              </Button>
            ) : null}
            {adminIsDriver && ["picked_up", "in_transit"].includes(order.status) ? (
              <Button
                size="lg"
                className="touch-target rounded-full"
                onClick={() => {
                  const err = advanceOrder(order.id, user.id, "arrived");
                  if (err) toast.error(err);
                  else toast.success("Marked arrived — waiting for confirmations");
                }}
              >
                I arrived
              </Button>
            ) : null}
            {adminIsDriver &&
            ["awaiting_confirmation", "arrived"].includes(order.status) &&
            !order.driver_confirmed ? (
              <Button
                size="lg"
                className="touch-target rounded-full"
                onClick={() => {
                  const err = confirmDelivery(order.id, user.id, "driver");
                  if (err) toast.error(err);
                  else toast.success("You confirmed delivery");
                }}
              >
                Confirm delivered
              </Button>
            ) : null}

            {!claimable && !adminIsDriver ? (
              <p className="text-base text-muted-foreground">
                {driverProfile ? "A driver is handling this order." : "—"}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <DeliveryMap
          markers={[
            {
              id: "p",
              lat: order.pickup_lat,
              lng: order.pickup_lng,
              label: "Pickup",
              kind: "pickup",
            },
            ...(warehouse
              ? [
                  {
                    id: "w",
                    lat: warehouse.lat,
                    lng: warehouse.lng,
                    label: warehouse.name,
                    kind: "warehouse" as const,
                  },
                ]
              : []),
            {
              id: "d",
              lat: order.dropoff_lat,
              lng: order.dropoff_lng,
              label: "Drop-off",
              kind: "dropoff",
            },
          ]}
          route={[
            { lat: order.pickup_lat, lng: order.pickup_lng },
            ...(warehouse ? [{ lat: warehouse.lat, lng: warehouse.lng }] : []),
            { lat: order.dropoff_lat, lng: order.dropoff_lng },
          ]}
        />
      </div>
    </AppShell>
  );
}
