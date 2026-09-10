"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CircleDot, Square } from "lucide-react";
import {
  formatDeliveryCash,
  quoteDeliveryPrice,
  clampQuoteToBusinessCosts,
  withBusinessOrderCosts,
} from "@direct/shared";
import { measureRouteKm } from "@/lib/route-distance";
import {
  DeliveryMap,
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
} from "@/components/delivery-map";
import { OrderReceipt } from "@/components/order-receipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { fmt, useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";

const PRESETS = [
  {
    label: "Hamra → Achrafieh",
    pickup: { address: "Hamra, Beirut", lat: 33.8959, lng: 35.478 },
    dropoff: { address: "Achrafieh, Beirut", lat: 33.8869, lng: 35.5194 },
  },
  {
    label: "Verdun → Airport area",
    pickup: { address: "Verdun, Beirut", lat: 33.875, lng: 35.485 },
    dropoff: { address: "Beirut Airport area", lat: 33.8208, lng: 35.4883 },
  },
];

type Point = { address: string; lat: number; lng: number };

function NewOrderFallback() {
  const { dict } = useI18n();
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <h1 className="heading-easy">{dict.order.createTitle}</h1>
      <div className="h-10 w-40 rounded-xl bg-muted" />
      <div className="h-64 w-full rounded-xl bg-muted" />
      <div className="h-80 w-full rounded-xl bg-muted" />
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<NewOrderFallback />}>
      <MapsProvider>
        <NewOrderContent />
      </MapsProvider>
    </Suspense>
  );
}

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { state, createOrder } = useStore();
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();
  const isBusiness = user?.role === "business";
  const shopReady =
    Boolean(isBusiness) &&
    user != null &&
    user.business_lat != null &&
    user.business_lng != null &&
    Boolean(user.business_address?.trim());

  const [step, setStep] = useState(1);
  const [product, setProduct] = useState("");
  const [placing, setPlacing] = useState(false);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [pickup, setPickup] = useState<Point>({
    ...PRESETS[0].pickup,
    address: searchParams.get("pickup") ?? PRESETS[0].pickup.address,
  });
  const [dropoff, setDropoff] = useState<Point>({
    ...PRESETS[0].dropoff,
    address: searchParams.get("dropoff") ?? PRESETS[0].dropoff.address,
  });
  const [pinTarget, setPinTarget] = useState<"pickup" | "dropoff">("pickup");

  useEffect(() => {
    if (
      user?.role === "business" &&
      user.business_lat != null &&
      user.business_lng != null &&
      user.business_address
    ) {
      setPickup({
        address: user.business_address,
        lat: user.business_lat,
        lng: user.business_lng,
      });
      setPinTarget("dropoff");
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setRouteKm(null);
    void measureRouteKm(
      { lat: pickup.lat, lng: pickup.lng },
      { lat: dropoff.lat, lng: dropoff.lng },
    ).then((km) => {
      if (!cancelled) setRouteKm(km);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  const distanceKm = routeKm;
  const quote = useMemo(() => {
    if (distanceKm == null) return null;
    const raw = quoteDeliveryPrice("normal", state.settings, distanceKm);
    if (user?.role !== "business") return raw;
    return clampQuoteToBusinessCosts(raw, withBusinessOrderCosts(user));
  }, [state.settings, distanceKm, user]);
  const costCaps = user?.role === "business" ? withBusinessOrderCosts(user) : null;

  const nearby = state.drivers
    .filter((d) => d.is_online)
    .map((d) => {
      const loc = state.locations.find((l) => l.driver_id === d.id);
      if (!loc) return null;
      return {
        id: d.id,
        lat: loc.lat,
        lng: loc.lng,
        label: dict.common.nearbyDriver,
        kind: "driver" as const,
      };
    })
    .filter(Boolean) as {
    id: string;
    lat: number;
    lng: number;
    label: string;
    kind: "driver";
  }[];

  async function onMapClick(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    if (isBusiness || pinTarget === "dropoff") {
      setDropoff({ address, lat, lng });
      return;
    }
    setPickup({ address, lat, lng });
    setPinTarget("dropoff");
  }

  async function placeOrder() {
    if (!user) return;
    if (user.role === "business" && !shopReady) {
      toast.error(dict.order.missingShop);
      return;
    }
    setPlacing(true);
    const result = await createOrder(user.id, {
      pickup_address: pickup.address,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      product_description: product,
    });
    setPlacing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(fmt(dict.order.placedToast, { number: result.orderNumber ?? "" }));
    router.push("/app/client");
  }

  return (
      <div className="flex flex-col gap-6">
          <h1 className="heading-easy">{dict.order.createTitle}</h1>
          <p className="text-easy text-muted-foreground">
            {fmt(dict.order.stepOf, { step, total: 4 })}
          </p>

          {step === 1 && isBusiness && !shopReady ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">{dict.order.whereTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-easy text-muted-foreground">{dict.order.missingShop}</p>
              </CardContent>
            </Card>
          ) : null}

          {step === 1 && !(isBusiness && !shopReady) ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">
                  {isBusiness ? dict.order.dropoffOnlyTitle : dict.order.whereTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isBusiness ? (
                  <p className="text-base text-muted-foreground">{dict.order.shopPickupHint}</p>
                ) : null}
                {mapsAvailable ? (
                  <div className="flex flex-col gap-2">
                    <Label className="text-lg">{dict.order.searchPlace}</Label>
                    <PlaceSearch
                      placeholder={dict.order.searchPlace}
                      className="h-12 text-lg"
                      onSelect={(place) => {
                        if (isBusiness || pinTarget === "dropoff") {
                          setDropoff(place);
                        } else {
                          setPickup(place);
                          setPinTarget("dropoff");
                        }
                      }}
                    />
                  </div>
                ) : null}

                {isBusiness ? null : (
                  <div className="flex gap-2" role="group" aria-label={dict.order.mapTip}>
                    <Button
                      type="button"
                      variant={pinTarget === "pickup" ? "default" : "outline"}
                      size="lg"
                      className="touch-target flex-1 rounded-full"
                      onClick={() => setPinTarget("pickup")}
                    >
                      <CircleDot data-icon="inline-start" />
                      {dict.order.setPickup}
                    </Button>
                    <Button
                      type="button"
                      variant={pinTarget === "dropoff" ? "default" : "outline"}
                      size="lg"
                      className="touch-target flex-1 rounded-full"
                      onClick={() => setPinTarget("dropoff")}
                    >
                      <Square data-icon="inline-start" />
                      {dict.order.setDropoff}
                    </Button>
                  </div>
                )}
                {mapsAvailable ? (
                  <p className="text-sm text-muted-foreground">
                    {isBusiness ? dict.order.shopPickupHint : dict.order.mapTip}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label className="text-lg">
                    {isBusiness ? dict.order.shopPickupLocked : dict.order.pickupAddress}
                  </Label>
                  <Input
                    className="h-12 text-lg"
                    value={locationLabel(pickup.address, pickup.lat, pickup.lng)}
                    onChange={(e) => setPickup((p) => ({ ...p, address: e.target.value }))}
                    readOnly={isBusiness}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-lg">{dict.order.dropoffAddress}</Label>
                  <Input
                    className="h-12 text-lg"
                    value={locationLabel(dropoff.address, dropoff.lat, dropoff.lng)}
                    onChange={(e) => setDropoff((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>

                {isBusiness ? null : (
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm text-muted-foreground">{dict.order.shortcuts}</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((p) => (
                        <Button
                          key={p.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="touch-target"
                          onClick={() => {
                            setPickup(p.pickup);
                            setDropoff(p.dropoff);
                          }}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="lg"
                  className="touch-target h-12 w-fit rounded-full px-6 text-base font-semibold"
                  onClick={() => setStep(2)}
                >
                  {dict.common.next}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">{dict.order.whatTitle}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Textarea
                  className="min-h-28 text-lg"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder={dict.order.whatPlaceholder}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="touch-target"
                    onClick={() => setStep(1)}
                  >
                    {dict.common.back}
                  </Button>
                  <Button
                    size="lg"
                    className="touch-target h-12 rounded-full px-6 text-base font-semibold"
                    disabled={product.trim().length < 2}
                    onClick={() => setStep(3)}
                  >
                    {dict.common.next}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">{dict.order.typeTitle}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-xl bg-muted p-4">
                  {quote == null || distanceKm == null ? (
                    <p className="text-base text-muted-foreground">{dict.order.calculatingRoute}</p>
                  ) : (
                    <>
                      <p className="text-xl">
                        {dict.order.price}:{" "}
                        <strong>{formatDeliveryCash(quote.totalUsd, quote.totalLbp)}</strong>
                      </p>
                      <p className="text-base text-muted-foreground">
                        {dict.order.distance}: {distanceKm.toFixed(1)} {dict.common.km}
                      </p>
                      {quote.nightUsd > 0 ? (
                        <p className="text-base text-muted-foreground">
                          {fmt(dict.order.nightNote, { amount: quote.nightUsd.toFixed(2) })}
                        </p>
                      ) : null}
                      <p className="text-base text-muted-foreground">{dict.order.cashNote}</p>
                      {costCaps ? (
                        <p className="mt-2 text-base text-muted-foreground">
                          {fmt(dict.order.priceRange, {
                            min: formatDeliveryCash(costCaps.order_min_usd, costCaps.order_min_lbp),
                            max: formatDeliveryCash(costCaps.order_max_usd, costCaps.order_max_lbp),
                          })}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="touch-target"
                    onClick={() => setStep(2)}
                  >
                    {dict.common.back}
                  </Button>
                  <Button
                    size="lg"
                    className="touch-target h-12 rounded-full px-6 text-base font-semibold"
                    onClick={() => setStep(4)}
                    disabled={quote == null}
                  >
                    {dict.common.next}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 4 && quote != null && distanceKm != null ? (
            <OrderReceipt
              order={{
                product_description: product,
                pickup_address: pickup.address,
                pickup_lat: pickup.lat,
                pickup_lng: pickup.lng,
                dropoff_address: dropoff.address,
                dropoff_lat: dropoff.lat,
                dropoff_lng: dropoff.lng,
                order_type: "normal",
              }}
              cashLabel={dict.common.cash}
              cashValue={formatDeliveryCash(quote.totalUsd, quote.totalLbp)}
              extraCashLines={[
                {
                  label: dict.order.distance,
                  value: `${distanceKm.toFixed(1)} ${dict.common.km}`,
                },
              ]}
              people={
                <div className="flex flex-col gap-2 text-base text-muted-foreground">
                  <p>{dict.order.cashNote}</p>
                  {quote.nightUsd > 0 ? (
                    <p>{fmt(dict.order.nightNote, { amount: quote.nightUsd.toFixed(2) })}</p>
                  ) : null}
                  {costCaps ? (
                    <p>
                      {fmt(dict.order.priceRange, {
                        min: formatDeliveryCash(costCaps.order_min_usd, costCaps.order_min_lbp),
                        max: formatDeliveryCash(costCaps.order_max_usd, costCaps.order_max_lbp),
                      })}
                    </p>
                  ) : null}
                </div>
              }
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="touch-target"
                    onClick={() => setStep(3)}
                  >
                    {dict.common.back}
                  </Button>
                  <Button
                    size="lg"
                    className="touch-target h-12 rounded-full px-6 text-base font-semibold"
                    onClick={() => void placeOrder()}
                    disabled={placing}
                  >
                    {dict.order.placeOrder}
                  </Button>
                </div>
              }
            />
          ) : null}

          <DeliveryMap
            standalone={false}
            markers={[
              {
                id: "pickup",
                lat: pickup.lat,
                lng: pickup.lng,
                label: dict.order.pickupAddress,
                place: pickup.address,
                kind: "pickup",
              },
              {
                id: "dropoff",
                lat: dropoff.lat,
                lng: dropoff.lng,
                label: dict.order.dropoffAddress,
                place: dropoff.address,
                kind: "dropoff",
              },
              ...nearby,
            ]}
            route={[
              { lat: pickup.lat, lng: pickup.lng },
              { lat: dropoff.lat, lng: dropoff.lng },
            ]}
            onMapClick={step === 1 ? onMapClick : undefined}
            routeHint={dict.order.nearbyHint}
          />
      </div>
  );
}
