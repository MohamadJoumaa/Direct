"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CircleDot, Square } from "lucide-react";
import {
  formatDeliveryCash,
  haversineKm,
  quoteDeliveryPrice,
  clampQuoteToBusinessCosts,
  withBusinessOrderCosts,
  type OrderType,
} from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import {
  DeliveryMap,
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
} from "@/components/delivery-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { fmt, useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";
import { cn } from "@/lib/utils";

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

export default function NewOrderPage() {
  return (
    <Suspense>
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
  const [orderType, setOrderType] = useState<OrderType>("normal");
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

  const distanceKm = useMemo(
    () => haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng),
    [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng],
  );
  const quote = useMemo(() => {
    const raw = quoteDeliveryPrice(orderType, state.settings, distanceKm);
    if (user?.role !== "business") return raw;
    return clampQuoteToBusinessCosts(raw, withBusinessOrderCosts(user));
  }, [orderType, state.settings, distanceKm, user]);
  const costCaps = user?.role === "business" ? withBusinessOrderCosts(user) : null;

  const typeOptions: { value: OrderType; label: string; desc: string }[] = [
    { value: "normal", label: dict.order.typeFast, desc: dict.order.typeFastDesc },
    { value: "long_distance", label: dict.order.typeLong, desc: dict.order.typeLongDesc },
    { value: "trusted", label: dict.order.typeTrusted, desc: dict.order.typeTrustedDesc },
    { value: "private", label: dict.order.typePrivate, desc: dict.order.typePrivateDesc },
    { value: "owner", label: dict.order.typeOwner, desc: dict.order.typeOwnerDesc },
  ];
  const selectedType = typeOptions.find((t) => t.value === orderType) ?? typeOptions[0];

  const nearby = state.drivers
    .filter((d) => d.is_online && d.driver_type === "fast")
    .map((d) => {
      const loc = state.locations.find((l) => l.driver_id === d.id);
      const profile = state.profiles.find((p) => p.id === d.id);
      if (!loc || !profile) return null;
      return {
        id: d.id,
        lat: loc.lat,
        lng: loc.lng,
        label: profile.full_name,
        role: d.driver_type,
        kind: "driver" as const,
      };
    })
    .filter(Boolean) as {
    id: string;
    lat: number;
    lng: number;
    label: string;
    role: string;
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

  function placeOrder() {
    if (!user) return;
    if (user.role === "business" && !shopReady) {
      toast.error(dict.order.missingShop);
      return;
    }
    const result = createOrder(user.id, {
      pickup_address: pickup.address,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      product_description: product,
      order_type: orderType,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(fmt(dict.order.placedToast, { number: result.orderNumber ?? "" }));
    router.push("/app/client");
  }

  return (
    <AppShell title={dict.nav.newOrder}>
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
                <nav
                  className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1"
                  aria-label={dict.order.typeTitle}
                >
                  {typeOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={orderType === t.value}
                      onClick={() => setOrderType(t.value)}
                      className={cn(
                        "touch-target flex-1 whitespace-nowrap rounded-full px-4 py-2 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        orderType === t.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>

                <div className="rounded-xl bg-muted p-4">
                  <p className="text-base font-medium">{selectedType.desc}</p>
                  {orderType === "long_distance" ? (
                    <p className="mt-1 text-sm text-muted-foreground">{dict.order.longTripNote}</p>
                  ) : null}
                  <p className="mt-3 text-xl">
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
                  >
                    {dict.common.next}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 4 ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">{dict.order.confirmTitle}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-lg">
                <p>
                  <strong>{dict.common.from}:</strong>{" "}
                  {locationLabel(pickup.address, pickup.lat, pickup.lng)}
                </p>
                <p>
                  <strong>{dict.common.to}:</strong>{" "}
                  {locationLabel(dropoff.address, dropoff.lat, dropoff.lng)}
                </p>
                <p>
                  <strong>{dict.common.item}:</strong> {product}
                </p>
                <p>
                  <strong>{dict.common.type}:</strong> {selectedType.label}
                </p>
                <p>
                  <strong>{dict.common.cash}:</strong>{" "}
                  {formatDeliveryCash(quote.totalUsd, quote.totalLbp)}
                </p>
                <p>
                  <strong>{dict.order.distance}:</strong> {distanceKm.toFixed(1)}{" "}
                  {dict.common.km}
                </p>
                <div className="flex gap-2">
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
                    onClick={placeOrder}
                  >
                    {dict.order.placeOrder}
                  </Button>
                </div>
              </CardContent>
            </Card>
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
    </AppShell>
  );
}
