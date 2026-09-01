"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { formatDeliveryCash } from "@direct/shared";
import { publicDriverInfo, publicDriverLabel } from "@/lib/demo-store";
import { AppShell } from "@/components/app-shell";
import { DeliveryMap } from "@/components/delivery-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { orderTypeLabel, useI18n } from "@/lib/i18n";
import { activeDriverId, trackingRoute } from "@/lib/maps-nav";

export default function ClientOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { state, confirmDelivery } = useStore();
  const { dict } = useI18n();
  const [stars, setStars] = useState(5);
  const order = state.orders.find((o) => o.id === params.id);

  if (!user || !order || order.client_id !== user.id) {
    return (
      <AppShell>
        <p className="text-easy">Order not found.</p>
      </AppShell>
    );
  }

  const driverId = activeDriverId(order);
  const loc = driverId ? state.locations.find((l) => l.driver_id === driverId) : null;
  const warehouse = order.warehouse_id
    ? state.warehouses.find((w) => w.id === order.warehouse_id)
    : null;
  // Clients never learn an admin took the order unless they picked the Direct team.
  const driverInfo = publicDriverInfo(state, order);

  function onConfirm() {
    if (!user) return;
    const err = confirmDelivery(order!.id, user.id, "client", stars);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Thank you — delivery confirmed");
    router.push("/app/client");
  }

  return (
    <AppShell title="Order">
      <div className="flex flex-col gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{order.product_description}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-lg">
            <p>
              <strong>{dict.common.type}:</strong> {orderTypeLabel(order.order_type, dict)}
            </p>
            <p>
              <strong>Status:</strong> {order.status.replaceAll("_", " ")}
            </p>
            <p>
              <strong>From:</strong> {order.pickup_address}
            </p>
            <p>
              <strong>To:</strong> {order.dropoff_address}
            </p>
            <p>
              <strong>Cash:</strong>{" "}
              {formatDeliveryCash(order.delivery_fee_usd, order.delivery_fee_lbp)}
            </p>
            <p>
              <strong>ETA:</strong> {order.eta_minutes ?? "—"} min
            </p>
            {driverInfo.kind === "none" ? (
              <p className="text-muted-foreground">{dict.common.waitingForDriver}</p>
            ) : driverInfo.kind === "direct" ? (
              <p>
                <strong>{dict.common.driver}:</strong> {dict.common.directTeam}
                {driverInfo.profile ? ` · ${driverInfo.profile.phone}` : ""}
              </p>
            ) : driverInfo.profile ? (
              <p>
                <strong>{dict.common.driver}:</strong> {driverInfo.profile.full_name} ·{" "}
                {driverInfo.profile.phone}
              </p>
            ) : (
              <p>
                <strong>{dict.common.driver}:</strong> {dict.common.yourDriver}
              </p>
            )}
          </CardContent>
        </Card>

        {(order.status === "awaiting_confirmation" || order.status === "arrived") &&
        !order.client_confirmed ? (
          <Card className="border-2 bg-muted">
            <CardHeader>
              <CardTitle className="text-2xl">Confirm delivery</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-easy">How was the driver?</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="lg"
                    variant={stars === n ? "default" : "outline"}
                    className="touch-target size-14 text-xl"
                    onClick={() => setStars(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <Button size="lg" className="touch-target h-14 text-xl w-fit" onClick={onConfirm}>
                Confirm received
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <DeliveryMap
          markers={[
            {
              id: "p",
              lat: order.pickup_lat,
              lng: order.pickup_lng,
              label: dict.common.pickup,
              kind: "pickup",
            },
            {
              id: "d",
              lat: order.dropoff_lat,
              lng: order.dropoff_lng,
              label: dict.common.dropoff,
              kind: "dropoff",
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
            ...(loc
              ? [
                  {
                    id: "live",
                    lat: loc.lat,
                    lng: loc.lng,
                    label: publicDriverLabel(state, order, {
                      waiting: dict.common.waitingForDriver,
                      directTeam: dict.common.directTeam,
                      yourDriver: dict.common.yourDriver,
                    }),
                    kind: "live" as const,
                  },
                ]
              : []),
          ]}
          route={trackingRoute(
            order,
            loc ? { lat: loc.lat, lng: loc.lng } : null,
            warehouse,
          )}
          routeHint={loc ? dict.client.trackingHint : dict.client.followHint}
        />
      </div>
    </AppShell>
  );
}
