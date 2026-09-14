"use client";

import { useEffect } from "react";
import { Zap } from "lucide-react";
import { formatDeliveryCash } from "@direct/shared";
import { publicDriverLabel, formatOrderNumber, publicDriverInfo, ordersForOwner } from "@/lib/demo-store";
import { LinkButton } from "@/components/link-button";
import { DeliveryMap } from "@/components/delivery-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { orderStatusLabel, useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";
import { activeDriverId, shortProduct, trackingRoute } from "@/lib/maps-nav";
import { OrderSearchField, useOrderSearch } from "@/components/order-search";
import { orderPartyExtras } from "@/lib/order-search";

export default function ClientHomePage() {
  const { user } = useAuth();
  const { state, refreshFromStorage } = useStore();
  const { dict, lang } = useI18n();

  const copy = {
    waiting: dict.common.waitingForDriver,
    directTeam: dict.common.directTeam,
    yourDriver: dict.common.yourDriver,
  };

  const myOrders = user ? ordersForOwner(state, user.id) : [];
  const ongoing = myOrders.filter((o) => !["completed", "cancelled", "disputed"].includes(o.status));
  const {
    query: ongoingQuery,
    setQuery: setOngoingQuery,
    showSearch: showOngoingSearch,
    filtered: filteredOngoing,
  } = useOrderSearch(ongoing, (o) => orderPartyExtras(o, state.profiles));

  const liveMarkers = ongoing.flatMap((o) => {
    const name = shortProduct(o.product_description);
    const markers: {
      id: string;
      lat: number;
      lng: number;
      label: string;
      place?: string;
      kind: "pickup" | "dropoff" | "live" | "driver" | "warehouse";
    }[] = [
      {
        id: `${o.id}-p`,
        lat: o.pickup_lat,
        lng: o.pickup_lng,
        label: `${name} · ${dict.common.pickup}`,
        place: o.pickup_address,
        kind: "pickup",
      },
      {
        id: `${o.id}-d`,
        lat: o.dropoff_lat,
        lng: o.dropoff_lng,
        label: `${name} · ${dict.common.dropoff}`,
        place: o.dropoff_address,
        kind: "dropoff",
      },
    ];
    const driverId = activeDriverId(o);
    const linked = publicDriverInfo(state, o).kind !== "none";
    const loc =
      linked && driverId ? state.locations.find((l) => l.driver_id === driverId) : null;
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

  // A live driver fix per ongoing order (once assigned and shared), keyed by order id.
  const liveByOrder = new Map(
    ongoing.flatMap((o) => {
      const driverId = activeDriverId(o);
      const linked = publicDriverInfo(state, o).kind !== "none";
      const loc = linked && driverId ? state.locations.find((l) => l.driver_id === driverId) : null;
      return loc ? [[o.id, loc] as const] : [];
    }),
  );
  const anyLive = liveByOrder.size > 0;
  // Route for every ongoing order, not just when there is exactly one —
  // each order contributes its own pickup→[hub]→drop-off (or live→next stop).
  const liveRoute =
    ongoing.length > 0
      ? ongoing.flatMap((o) => {
          const warehouse = o.warehouse_id
            ? state.warehouses.find((w) => w.id === o.warehouse_id)
            : null;
          const live = liveByOrder.get(o.id);
          return trackingRoute(o, live ? { lat: live.lat, lng: live.lng } : null, warehouse);
        })
      : undefined;

  useEffect(() => {
    if (!anyLive) return;
    const id = window.setInterval(() => refreshFromStorage(), 4000);
    return () => window.clearInterval(id);
  }, [anyLive, refreshFromStorage]);

  return (
      <div className="flex flex-col gap-6">
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
            <OrderSearchField
              show={showOngoingSearch}
              value={ongoingQuery}
              onChange={setOngoingQuery}
            />
            {filteredOngoing.length === 0 ? (
              <p className="text-easy text-muted-foreground">{dict.common.noOrderMatches}</p>
            ) : null}
            {filteredOngoing.map((o) => (
              <Card key={o.id} className="border-2">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                      {formatOrderNumber(o.order_number)}
                    </p>
                    <CardTitle className="text-2xl">{o.product_description}</CardTitle>
                    <p className="text-lg text-muted-foreground">
                      {locationLabel(o.pickup_address, o.pickup_lat, o.pickup_lng, lang)} →{" "}
                      {locationLabel(o.dropoff_address, o.dropoff_lat, o.dropoff_lng, lang)}
                    </p>
                    <p className="mt-1 text-base text-muted-foreground">
                      {dict.common.driver}: {publicDriverLabel(state, o, copy)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="text-sm capitalize">
                      {orderStatusLabel(o.status, dict)}
                    </Badge>
                    {o.is_urgent ? (
                      <Badge className="gap-1 bg-amber-500 text-black hover:bg-amber-500">
                        <Zap className="size-3.5" />
                        {dict.order.urgentBadge}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg">
                    {dict.client.etaAbout}{" "}
                    <strong>
                      {o.eta_minutes ?? "—"} {dict.common.minutes}
                    </strong>{" "}
                    · {formatDeliveryCash(o.delivery_fee_usd, o.delivery_fee_lbp)} {dict.common.cash}
                  </p>
                  <LinkButton href={`/app/client/orders/${o.id}`} size="lg" className="touch-target">
                    {(o.status === "awaiting_confirmation" || o.status === "arrived") &&
                    !o.client_confirmed
                      ? dict.client.confirmAndRate
                      : dict.admin.details}
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
            routeHint={anyLive ? dict.client.trackingHint : dict.client.followHint}
            showLegend={false}
          />
        ) : null}
      </div>
  );
}
