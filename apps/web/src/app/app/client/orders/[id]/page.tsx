"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientPriceError, formatDeliveryCash, scaleLbpToUsd } from "@direct/shared";
import {
  orderPriceFloorLbp,
  orderPriceFloorUsd,
  publicDriverInfo,
  publicDriverLabel,
  profilePhotoUrl,
  ordersForOwner,
} from "@/lib/demo-store";
import { DeliveryMap } from "@/components/delivery-map";
import { LinkedContactCard } from "@/components/linked-contact";
import { OrderReceipt } from "@/components/order-receipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { fmt, useI18n } from "@/lib/i18n";
import { activeDriverId, trackingRoute } from "@/lib/maps-nav";

/** How much one tap of the price arrows moves the offer, in USD. */
const PRICE_STEP_USD = 0.5;

export default function ClientOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { state, confirmDelivery, cancelOrder, updateOrderPrice } = useStore();
  const { dict } = useI18n();
  const [stars, setStars] = useState(5);
  const [priceInput, setPriceInput] = useState("");
  const order = state.orders.find((o) => o.id === params.id);

  if (!user || !order || !ordersForOwner(state, user.id).some((o) => o.id === order.id)) {
    return (
        <p className="text-easy">Order not found.</p>
    );
  }

  const isHistory = ["completed", "cancelled", "disputed"].includes(order.status);
  // Clients never learn an admin took the order unless they picked the Direct team.
  const driverInfo = publicDriverInfo(state, order);
  const driverId = activeDriverId(order);
  const loc =
    driverInfo.kind !== "none" && driverId
      ? state.locations.find((l) => l.driver_id === driverId)
      : null;
  const warehouse = order.warehouse_id
    ? state.warehouses.find((w) => w.id === order.warehouse_id)
    : null;

  // While no driver has taken the order, the client can still raise what they
  // pay — but never below what Direct originally quoted.
  const floorUsd = order ? orderPriceFloorUsd(order) : 0;
  const floorLbp = order ? orderPriceFloorLbp(order) : 0;
  const typedUsd = priceInput.trim() === "" ? null : Number(priceInput);
  const priceProblem =
    typedUsd == null ? null : clientPriceError({ requestedUsd: typedUsd, quotedUsd: floorUsd });
  const priceMessage =
    priceProblem === "below_quote"
      ? fmt(dict.order.priceBelowQuote, { min: formatDeliveryCash(floorUsd, floorLbp) })
      : priceProblem === "invalid"
        ? dict.order.priceInvalid
        : null;

  // What the arrows currently show: the untouched order price until the client
  // starts nudging it.
  const nudging = typedUsd != null && Number.isFinite(typedUsd);
  const offeredUsd = nudging ? typedUsd : order.delivery_fee_usd;
  const offeredLbp = nudging
    ? scaleLbpToUsd(typedUsd, order.delivery_fee_usd, order.delivery_fee_lbp)
    : order.delivery_fee_lbp;

  function nudgePrice(direction: 1 | -1) {
    const next = Math.round((offeredUsd + direction * PRICE_STEP_USD) * 100) / 100;
    setPriceInput(Math.max(floorUsd, next).toFixed(2));
  }

  function onSavePrice(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !order || typedUsd == null) return;
    const err = updateOrderPrice(order.id, user.id, typedUsd);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.order.priceUpdated);
    setPriceInput("");
  }

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
      <div className="flex flex-col gap-6">
        <OrderReceipt
          order={order}
          warehouse={warehouse}
          cashLabel={dict.common.cash}
          cashValue={formatDeliveryCash(order.delivery_fee_usd, order.delivery_fee_lbp)}
          actions={
            (order.status === "awaiting_confirmation" || order.status === "arrived") &&
            !order.client_confirmed ? (
              <>
                <p className="text-easy">{dict.client.howWasDriver}</p>
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
                  {dict.client.confirmReceived}
                </Button>
              </>
            ) : null
          }
          people={
            driverInfo.kind === "none" ? (
              <p className="text-muted-foreground">{dict.common.waitingForDriver}</p>
            ) : driverInfo.kind === "direct" && driverInfo.contact ? (
              <LinkedContactCard
                roleLabel={dict.common.directTeam}
                phoneLabel={dict.common.phone}
                contact={driverInfo.contact}
                photoSrc={profilePhotoUrl(state, driverInfo.contact.id)}
                callLabel={dict.client.callDriver}
              />
            ) : driverInfo.kind === "direct" ? (
              <p>
                <strong>{dict.common.driver}:</strong> {dict.common.directTeam}
              </p>
            ) : driverInfo.contact ? (
              <LinkedContactCard
                roleLabel={dict.common.driver}
                phoneLabel={dict.common.phone}
                contact={driverInfo.contact}
                photoSrc={profilePhotoUrl(state, driverInfo.contact.id)}
                callLabel={dict.client.callDriver}
              />
            ) : (
              <p>
                <strong>{dict.common.driver}:</strong> {dict.common.yourDriver}
              </p>
            )
          }
        />

        {order.status === "pending" ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">{dict.order.editPrice}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSavePrice} className="flex flex-col gap-3">
                {/* Same control as the order form: arrows beside the price,
                    never below what Direct recommends. */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-1 rounded-full border-2 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="size-11 shrink-0 rounded-full"
                      aria-label={dict.order.lowerPrice}
                      disabled={offeredUsd <= floorUsd}
                      onClick={() => nudgePrice(-1)}
                    >
                      <ChevronDown className="size-5" />
                    </Button>
                    <strong className="px-2 text-center text-xl tabular-nums">
                      {formatDeliveryCash(offeredUsd, offeredLbp)}
                    </strong>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="size-11 shrink-0 rounded-full"
                      aria-label={dict.order.raisePrice}
                      onClick={() => nudgePrice(1)}
                    >
                      <ChevronUp className="size-5" />
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="touch-target rounded-full px-6"
                    disabled={typedUsd == null || priceMessage != null}
                  >
                    {dict.common.save}
                  </Button>
                </div>
                {offeredUsd > floorUsd ? (
                  <p className="text-base text-muted-foreground">
                    {dict.order.quotedPrice}: {formatDeliveryCash(floorUsd, floorLbp)}
                  </p>
                ) : null}
                <p className="text-base text-muted-foreground">
                  {fmt(dict.order.priceEditHint, {
                    min: formatDeliveryCash(floorUsd, floorLbp),
                  })}
                </p>
                {priceMessage ? (
                  <p className="text-base font-medium text-destructive">{priceMessage}</p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        ) : null}

        {["pending", "accepted"].includes(order.status) && (
          <Card className="border-2 border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 pt-6">
              <p className="text-easy">
                {order.status === "pending"
                  ? "No driver has accepted yet — you can cancel freely."
                  : "A driver accepted your order. Are you sure you want to cancel?"}
              </p>
              <Button
                size="lg"
                variant="destructive"
                className="touch-target h-14 text-xl w-fit"
                onClick={() => {
                  if (!user) return;
                  const err = cancelOrder(order.id, user.id);
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  toast.success("Order cancelled");
                  router.push("/app/client");
                }}
              >
                Cancel order
              </Button>
            </CardContent>
          </Card>
        )}

        {isHistory ? null : (
          <DeliveryMap
            markers={[
              {
                id: "p",
                lat: order.pickup_lat,
                lng: order.pickup_lng,
                label: dict.common.pickup,
                place: order.pickup_address,
                kind: "pickup",
              },
              {
                id: "d",
                lat: order.dropoff_lat,
                lng: order.dropoff_lng,
                label: dict.common.dropoff,
                place: order.dropoff_address,
                kind: "dropoff",
              },
              ...(warehouse
                ? [
                    {
                      id: "w",
                      lat: warehouse.lat,
                      lng: warehouse.lng,
                      label: warehouse.name,
                      place: warehouse.address,
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
        )}
      </div>
  );
}
