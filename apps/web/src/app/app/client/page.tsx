"use client";

import { publicDriverLabel } from "@/lib/demo-store";
import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { DeliveryMap } from "@/components/delivery-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { orderTypeLabel, useI18n } from "@/lib/i18n";
import { activeDriverId, shortProduct, trackingRoute } from "@/lib/maps-nav";

export default function ClientHomePage() {
  const { user } = useAuth();
  const { state } = useStore();
  const { dict } = useI18n();
  if (!user) return null;

  const copy = {
    waiting: dict.common.waitingForDriver,
    directTeam: dict.common.directTeam,
    yourDriver: dict.common.yourDriver,
  };

  const myOrders = state.orders.filter((o) => o.client_id === user.id);
  const ongoing = myOrders.filter((o) => !["completed", "cancelled", "disputed"].includes(o.status));
  const needsConfirm = ongoing.find(
    (o) => o.status === "awaiting_confirmation" && !o.client_confirmed,
  );

  const liveMarkers = ongoing.flatMap((o) => {
    const name = shortProduct(o.product_description);
    const markers: {
      id: string;
      lat: number;
      lng: number;
      label: string;
      kind: "pickup" | "dropoff" | "live" | "driver" | "warehouse";
    }[] = [
      {
        id: `${o.id}-p`,
        lat: o.pickup_lat,
        lng: o.pickup_lng,
        label: `${name} · ${dict.common.pickup}`,
        kind: "pickup",
      },
      {
        id: `${o.id}-d`,
        lat: o.dropoff_lat,
        lng: o.dropoff_lng,
        label: `${name} · ${dict.common.dropoff}`,
        kind: "dropoff",
      },
    ];
    const driverId = activeDriverId(o);
    const loc = driverId ? state.locations.find((l) => l.driver_id === driverId) : null;
    if (loc) {
      markers.push({
        id: `${o.id}-live`,
        lat: loc.lat,
        lng: loc.lng,
        label: publicDriverLabel(state, o, copy),
        kind: "live",
      });
    }
    return markers;
  });

  const single = ongoing.length === 1 ? ongoing[0] : null;
  const singleWarehouse =
    single?.warehouse_id ? state.warehouses.find((w) => w.id === single.warehouse_id) : null;
  const singleLiveId = single ? activeDriverId(single) : null;
  const singleLive = singleLiveId
    ? (state.locations.find((l) => l.driver_id === singleLiveId) ?? null)
    : null;
  const liveRoute = single
    ? trackingRoute(
        single,
        singleLive ? { lat: singleLive.lat, lng: singleLive.lng } : null,
        singleWarehouse,
      )
    : undefined;

  return (
    <AppShell title={dict.nav.home}>
      <div className="flex flex-col gap-6">
        {needsConfirm ? (
          <Card className="border-2 bg-muted">
            <CardHeader>
              <CardTitle className="text-2xl">{dict.client.pleaseConfirmTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-easy">{dict.client.pleaseConfirmBody}</p>
              <LinkButton
                href={`/app/client/orders/${needsConfirm.id}`}
                size="lg"
                className="touch-target w-fit text-lg"
              >
                {dict.client.confirmAndRate}
              </LinkButton>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="heading-easy">{dict.client.yourOrders}</h1>
          <LinkButton
            href="/app/client/new"
            size="lg"
            className="touch-target h-12 rounded-full px-6 text-base font-semibold"
          >
            {dict.nav.newOrder}
          </LinkButton>
        </div>

        {ongoing.length === 0 ? (
          <Card className="border-2">
            <CardContent className="py-10 text-center text-easy text-muted-foreground">
              {dict.client.noOngoing}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {ongoing.map((o) => (
              <Card key={o.id} className="border-2">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-2xl">{o.product_description}</CardTitle>
                    <p className="text-lg text-muted-foreground">
                      {o.pickup_address} → {o.dropoff_address}
                    </p>
                    <p className="mt-1 text-base text-muted-foreground">
                      {dict.common.driver}: {publicDriverLabel(state, o, copy)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className="text-sm">{orderTypeLabel(o.order_type, dict)}</Badge>
                    <Badge variant="outline" className="text-sm capitalize">
                      {o.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg">
                    {dict.client.etaAbout}{" "}
                    <strong>
                      {o.eta_minutes ?? "—"} {dict.common.minutes}
                    </strong>{" "}
                    · ${o.delivery_fee_usd.toFixed(2)} {dict.common.cash}
                  </p>
                  <LinkButton href={`/app/client/orders/${o.id}`} size="lg" className="touch-target">
                    {dict.admin.details}
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {ongoing.length > 0 ? (
          <DeliveryMap
            markers={liveMarkers}
            route={liveRoute}
            routeHint={singleLive ? dict.client.trackingHint : dict.client.followHint}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
