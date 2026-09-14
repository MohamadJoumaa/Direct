"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, CircleDot, MapPin, Square, Zap } from "lucide-react";
import {
  URGENT_PRICE_MULTIPLIER,
  applyUrgentPricing,
  clientPriceError,
  formatDeliveryCash,
  quoteDeliveryPrice,
  clampQuoteToBusinessCosts,
  scaleLbpToUsd,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { fmt, useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";

type Point = { address: string; lat: number; lng: number };

/** How much one tap of the price arrows moves the offer, in USD. */
const PRICE_STEP_USD = 0.5;

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

/** One of the two chosen points, shown but never edited by hand. */
function ChosenPoint({
  icon: Icon,
  label,
  value,
  placeholder,
}: {
  icon: typeof CircleDot;
  label: string;
  value: string | null;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-base font-medium text-muted-foreground">{label}</span>
      <div className="flex min-h-12 items-center gap-2 rounded-xl bg-muted px-3 py-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span
          className={
            value ? "text-base font-medium break-words" : "text-base text-muted-foreground"
          }
        >
          {value ?? placeholder}
        </span>
      </div>
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
  const { user } = useAuth();
  const { state, createOrder } = useStore();
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();
  const isBusiness = user?.role === "business";

  const [step, setStep] = useState(1);
  const [product, setProduct] = useState("");
  const [placing, setPlacing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [pickup, setPickup] = useState<Point | null>(null);
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [pinTarget, setPinTarget] = useState<"pickup" | "dropoff">("pickup");
  const [urgent, setUrgent] = useState(false);
  // Empty means "whatever Direct quotes" — only a typed value overrides it.
  const [priceInput, setPriceInput] = useState("");

  // The shop is a business's usual pickup, so it starts filled in — but it is
  // only a default: the pin, the search box and "use my location" all move it
  // exactly as they do for a client.
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

  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const dropoffLat = dropoff?.lat;
  const dropoffLng = dropoff?.lng;

  useEffect(() => {
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      setRouteKm(null);
      return;
    }
    let cancelled = false;
    setRouteKm(null);
    void measureRouteKm(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng },
    ).then((km) => {
      if (!cancelled) setRouteKm(km);
    });
    return () => {
      cancelled = true;
    };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const distanceKm = routeKm;
  const quote = useMemo(() => {
    if (distanceKm == null || !pickup || !dropoff) return null;
    const raw = quoteDeliveryPrice("normal", state.settings, distanceKm);
    const ranged =
      user?.role === "business"
        ? clampQuoteToBusinessCosts(raw, withBusinessOrderCosts(user))
        : raw;
    // Urgency multiplies after the business range, exactly as the store does
    // when the order is actually created.
    return applyUrgentPricing(ranged, urgent);
  }, [state.settings, distanceKm, user, pickup, dropoff, urgent]);

  // What the client typed, if anything, and whether Direct can accept it.
  const typedUsd = priceInput.trim() === "" ? null : Number(priceInput);
  const priceProblem =
    typedUsd == null || quote == null
      ? null
      : clientPriceError({ requestedUsd: typedUsd, quotedUsd: quote.totalUsd });
  const useTypedPrice = typedUsd != null && priceProblem == null;
  const finalUsd = quote == null ? 0 : useTypedPrice ? typedUsd : quote.totalUsd;
  const finalLbp =
    quote == null
      ? 0
      : useTypedPrice
        ? scaleLbpToUsd(typedUsd, quote.totalUsd, quote.totalLbp)
        : quote.totalLbp;
  const priceMessage =
    priceProblem === "below_quote" && quote
      ? fmt(dict.order.priceBelowQuote, {
          min: formatDeliveryCash(quote.totalUsd, quote.totalLbp),
        })
      : priceProblem === "invalid"
        ? dict.order.priceInvalid
        : null;

  /** Walk the price one step up or down, never below what Direct quotes. */
  function nudgePrice(direction: 1 | -1) {
    if (!quote) return;
    const base = typedUsd != null && Number.isFinite(typedUsd) ? typedUsd : quote.totalUsd;
    const next = Math.round((base + direction * PRICE_STEP_USD) * 100) / 100;
    // Back at the quote means "whatever Direct says" again, not a typed value
    // that happens to match — so the recommended line disappears with it.
    setPriceInput(next <= quote.totalUsd ? "" : next.toFixed(2));
  }

  function toggleUrgent(next: boolean) {
    setUrgent(next);
    // The quote just moved by 3×, so any price typed against the old one is
    // no longer meaningful — start from the new quote instead.
    setPriceInput("");
  }

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
    if (pinTarget === "dropoff") {
      setDropoff({ address, lat, lng });
      return;
    }
    setPickup({ address, lat, lng });
    setPinTarget("dropoff");
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(dict.driver.locationDenied);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        void reverseGeocode(lat, lng).then((address) => {
          if (pinTarget === "dropoff") {
            setDropoff({ address, lat, lng });
          } else {
            setPickup({ address, lat, lng });
            setPinTarget("dropoff");
          }
          setLocating(false);
        });
      },
      () => {
        toast.error(dict.driver.locationDenied);
        setLocating(false);
      },
    );
  }

  async function placeOrder() {
    if (!user || !pickup || !dropoff) return;
    if (priceMessage) {
      toast.error(priceMessage);
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
      is_urgent: urgent,
      ...(useTypedPrice ? { price_usd: typedUsd } : {}),
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

          {step === 1 ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">{dict.order.whereTitle}</CardTitle>
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
                        if (pinTarget === "dropoff") {
                          setDropoff(place);
                        } else {
                          setPickup(place);
                          setPinTarget("dropoff");
                        }
                      }}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2" role="group" aria-label={dict.order.mapTip}>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="touch-target flex-1 rounded-full"
                    onClick={useMyLocation}
                    disabled={locating}
                  >
                    <MapPin data-icon="inline-start" />
                    {dict.order.useMyLocation}
                  </Button>
                </div>
                {mapsAvailable ? (
                  <p className="text-sm text-muted-foreground">{dict.order.mapTip}</p>
                ) : null}

                {/* Read-outs, not inputs: an address typed here would never
                    move the pin, so the map and the search box own the choice
                    and these two just show where it landed. Side by side, they
                    cost one row instead of four. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChosenPoint
                    icon={CircleDot}
                    label={dict.order.pickupAddress}
                    value={pickup ? locationLabel(pickup.address, pickup.lat, pickup.lng) : null}
                    placeholder={dict.home.pickupPlaceholder}
                  />
                  <ChosenPoint
                    icon={Square}
                    label={dict.order.dropoffAddress}
                    value={dropoff ? locationLabel(dropoff.address, dropoff.lat, dropoff.lng) : null}
                    placeholder={dict.home.dropoffPlaceholder}
                  />
                </div>

                <Button
                  size="lg"
                  className="touch-target h-12 w-fit rounded-full px-6 text-base font-semibold"
                  onClick={() => setStep(2)}
                  disabled={!pickup || !dropoff}
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
                      {/* The price is the control: arrows beside it walk it up
                          from what Direct recommends, never below. */}
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xl">{dict.order.price}:</span>
                        <div className="inline-flex items-center gap-1 rounded-full border-2 bg-background p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-lg"
                            className="size-11 shrink-0 rounded-full"
                            aria-label={dict.order.lowerPrice}
                            disabled={!useTypedPrice}
                            onClick={() => nudgePrice(-1)}
                          >
                            <ChevronDown className="size-5" />
                          </Button>
                          <strong className="px-2 text-center text-xl tabular-nums">
                            {formatDeliveryCash(finalUsd, finalLbp)}
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
                        {useTypedPrice ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="touch-target rounded-full"
                            onClick={() => setPriceInput("")}
                          >
                            {dict.order.useQuotedPrice}
                          </Button>
                        ) : null}
                      </div>
                      {useTypedPrice ? (
                        <p className="text-base text-muted-foreground">
                          {dict.order.quotedPrice}:{" "}
                          {formatDeliveryCash(quote.totalUsd, quote.totalLbp)}
                        </p>
                      ) : null}
                      <p className="text-base text-muted-foreground">
                        {fmt(dict.order.priceEditHint, {
                          min: formatDeliveryCash(quote.totalUsd, quote.totalLbp),
                        })}
                      </p>
                      {priceMessage ? (
                        <p className="text-base font-medium text-destructive">{priceMessage}</p>
                      ) : null}
                      <p className="text-base text-muted-foreground">
                        {dict.order.distance}: {distanceKm.toFixed(1)} {dict.common.km}
                      </p>
                      {urgent ? (
                        <p className="text-base font-medium text-amber-600 dark:text-amber-400">
                          {dict.order.urgentApplied}
                        </p>
                      ) : null}
                      {quote.nightUsd > 0 ? (
                        <p className="text-base text-muted-foreground">
                          {fmt(dict.order.nightNote, { amount: quote.nightUsd.toFixed(2) })}
                        </p>
                      ) : null}
                      <p className="text-base text-muted-foreground">{dict.order.cashNote}</p>
                    </>
                  )}
                </div>

                {/* Urgent: three times the price, and the note says so before
                    the box is ticked, not after. */}
                <div className="flex flex-col gap-2 rounded-xl border-2 p-4">
                  <label className="touch-target flex min-h-11 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={urgent}
                      onChange={(e) => toggleUrgent(e.target.checked)}
                    />
                    <span className="inline-flex items-center gap-2 text-lg font-semibold">
                      <Zap className="size-5 text-amber-500" aria-hidden />
                      {dict.order.urgentLabel}
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-sm font-bold text-amber-700 dark:text-amber-400">
                        ×{URGENT_PRICE_MULTIPLIER}
                      </span>
                    </span>
                  </label>
                  <p className="text-base text-muted-foreground">{dict.order.urgentPriceNote}</p>
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
                    disabled={quote == null || priceMessage != null}
                  >
                    {dict.common.next}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 4 && quote != null && distanceKm != null && pickup && dropoff ? (
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
                is_urgent: urgent,
              }}
              cashLabel={dict.common.cash}
              cashValue={formatDeliveryCash(finalUsd, finalLbp)}
              extraCashLines={[
                {
                  label: dict.order.distance,
                  value: `${distanceKm.toFixed(1)} ${dict.common.km}`,
                },
                ...(useTypedPrice
                  ? [
                      {
                        label: dict.order.quotedPrice,
                        value: formatDeliveryCash(quote.totalUsd, quote.totalLbp),
                      },
                    ]
                  : []),
              ]}
              people={
                <div className="flex flex-col gap-2 text-base text-muted-foreground">
                  <p>{dict.order.cashNote}</p>
                  {urgent ? <p>{dict.order.urgentPriceNote}</p> : null}
                  {quote.nightUsd > 0 ? (
                    <p>{fmt(dict.order.nightNote, { amount: quote.nightUsd.toFixed(2) })}</p>
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
            // The pins already say all of this on the map itself, and the
            // addresses are right above it — the list underneath was noise.
            showLegend={false}
            markers={[
              ...(pickup
                ? [
                    {
                      id: "pickup",
                      lat: pickup.lat,
                      lng: pickup.lng,
                      label: dict.order.pickupAddress,
                      place: pickup.address,
                      kind: "pickup" as const,
                    },
                  ]
                : []),
              ...(dropoff
                ? [
                    {
                      id: "dropoff",
                      lat: dropoff.lat,
                      lng: dropoff.lng,
                      label: dict.order.dropoffAddress,
                      place: dropoff.address,
                      kind: "dropoff" as const,
                    },
                  ]
                : []),
              ...nearby,
            ]}
            route={
              pickup && dropoff
                ? [
                    { lat: pickup.lat, lng: pickup.lng },
                    { lat: dropoff.lat, lng: dropoff.lng },
                  ]
                : undefined
            }
            onMapClick={step === 1 ? onMapClick : undefined}
            routeHint={dict.order.nearbyHint}
          />
      </div>
  );
}
