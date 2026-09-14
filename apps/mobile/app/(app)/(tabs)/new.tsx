import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Zap } from "lucide-react-native";
import {
  applyUrgentPricing,
  clampQuoteToBusinessCosts,
  clientPriceError,
  formatDeliveryCash,
  quoteDeliveryPrice,
  roundUsd,
  scaleLbpToUsd,
  withBusinessOrderCosts,
} from "@direct/shared";
import { locationLabel } from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { DeliveryMap, type MapPoint } from "@/components/map/delivery-map";
import {
  LocationField,
  LocationPicker,
  type PickedLocation,
} from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Field, SwitchField } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { fmt, useI18n } from "@/lib/i18n";
import { measureRouteKm } from "@/lib/route-distance";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

type Target = "pickup" | "dropoff" | null;

/**
 * Create an order.
 *
 * All the pricing comes from `@direct/shared` in exactly the order the store
 * applies it -- quote, then the per-business clamp, then urgent ×3 -- so the
 * price previewed here is the price `createOrder` computes. Nothing about the
 * fare is re-derived locally.
 */
export default function NewOrder() {
  const { dict, lang } = useI18n();
  const { colors } = useTheme();
  const { user, effectiveRole } = useAuth();
  const { state, createOrder } = useStore();
  const toast = useToast();
  const router = useRouter();

  const isBusiness = effectiveRole === "business";

  const [pickup, setPickup] = useState<PickedLocation | null>(null);
  const [dropoff, setDropoff] = useState<PickedLocation | null>(null);
  const [picking, setPicking] = useState<Target>(null);
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [typedPrice, setTypedPrice] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // A business ships from its shop by default, but is free to change it: the
  // shop is a pre-fill, not a constraint.
  useEffect(() => {
    if (!isBusiness || pickup || !user?.business_lat || !user?.business_lng) return;
    setPickup({
      lat: user.business_lat,
      lng: user.business_lng,
      label: locationLabel(user.business_address, user.business_lat, user.business_lng, lang),
    });
  }, [isBusiness, pickup, user, lang]);

  // Driving distance, measured the same way the store will measure it.
  useEffect(() => {
    if (!pickup || !dropoff) {
      setDistanceKm(null);
      return;
    }
    let alive = true;
    setMeasuring(true);
    void measureRouteKm(pickup, dropoff).then((km) => {
      if (!alive) return;
      setDistanceKm(km);
      setMeasuring(false);
    });
    return () => {
      alive = false;
    };
  }, [pickup, dropoff]);

  const quote = useMemo(() => {
    if (distanceKm == null) return null;
    const raw = quoteDeliveryPrice("normal", state.settings, distanceKm);
    const ranged = isBusiness ? clampQuoteToBusinessCosts(raw, withBusinessOrderCosts(user)) : raw;
    // Urgent is applied last, after the business clamp: a per-business ceiling
    // must not swallow the ×3, which is the whole point of the option.
    return applyUrgentPricing(ranged, urgent);
  }, [distanceKm, state.settings, isBusiness, user, urgent]);

  const typedUsd = Number(typedPrice);
  const priceIssue =
    !editingPrice || !quote || typedPrice.trim() === ""
      ? null
      : clientPriceError({ requestedUsd: typedUsd, quotedUsd: quote.totalUsd });

  const finalUsd = editingPrice && quote && !priceIssue ? roundUsd(typedUsd) : quote?.totalUsd;
  const finalLbp =
    editingPrice && quote && !priceIssue
      ? scaleLbpToUsd(typedUsd, quote.totalUsd, quote.totalLbp)
      : quote?.totalLbp;

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = [];
    if (pickup) list.push({ id: "pickup", kind: "pickup", ...pickup });
    if (dropoff) list.push({ id: "dropoff", kind: "dropoff", ...dropoff });
    return list;
  }, [pickup, dropoff]);

  const canSubmit =
    Boolean(pickup && dropoff && description.trim() && quote) && !priceIssue && !measuring;

  async function submit() {
    if (!user || !pickup || !dropoff || !quote) return;
    setSubmitting(true);
    const result = await createOrder(user.id, {
      pickup_address: pickup.label,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.label,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      product_description: description.trim(),
      is_urgent: urgent,
      price_usd: editingPrice && !priceIssue ? roundUsd(typedUsd) : undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(fmt(dict.order.placedToast, { number: `#${result.orderNumber}` }));
    setDropoff(null);
    setDescription("");
    setUrgent(false);
    setEditingPrice(false);
    setTypedPrice("");
    router.push("/home");
  }

  return (
    <>
      <AppHeader title={dict.order.createTitle} />
      <Screen
        footer={
          <Button
            title={dict.order.placeOrder}
            size="lg"
            disabled={!canSubmit}
            loading={submitting}
            onPress={() => void submit()}
          />
        }
      >
        {points.length > 0 ? <DeliveryMap points={points} height={180} /> : null}

        <Section title={dict.order.whereTitle}>
          <Stack gap="md">
            <LocationField
              label={dict.order.pickupAddress}
              value={pickup?.label}
              placeholder={dict.order.setPickup}
              onPress={() => setPicking("pickup")}
            />
            <LocationField
              label={dict.order.dropoffAddress}
              value={dropoff?.label}
              placeholder={dict.order.setDropoff}
              onPress={() => setPicking("dropoff")}
            />
            {isBusiness ? (
              <Text variant="caption" color="mutedForeground">
                {dict.order.shopPickupHint}
              </Text>
            ) : null}
          </Stack>
        </Section>

        <Section title={dict.order.whatTitle}>
          <Field
            value={description}
            onChangeText={setDescription}
            placeholder={dict.order.whatPlaceholder}
            multiline
          />
        </Section>

        <Section title={dict.order.typeTitle}>
          <Card>
            <Stack gap="md">
              {measuring ? (
                <Text variant="callout" color="mutedForeground">
                  {dict.order.calculatingRoute}
                </Text>
              ) : quote ? (
                <>
                  <Row justify="space-between">
                    <Text variant="callout" color="mutedForeground">
                      {dict.order.distance}
                    </Text>
                    <Text variant="callout" weight="semibold" numeric>
                      {quote.distanceKm.toFixed(1)} {dict.common.km}
                    </Text>
                  </Row>

                  <Divider />

                  <Row justify="space-between">
                    <Text variant="subheading" weight="semibold">
                      {dict.order.price}
                    </Text>
                    <Text variant="heading" weight="bold" numeric>
                      {formatDeliveryCash(finalUsd ?? quote.totalUsd, finalLbp ?? quote.totalLbp)}
                    </Text>
                  </Row>

                  {quote.nightUsd > 0 ? (
                    <Text variant="caption" color="mutedForeground">
                      {fmt(dict.order.nightNote, {
                        amount: formatDeliveryCash(quote.nightUsd, quote.nightLbp),
                      })}
                    </Text>
                  ) : null}
                  {urgent ? (
                    <Text variant="caption" color="destructive">
                      {dict.order.urgentApplied}
                    </Text>
                  ) : null}
                  <Text variant="caption" color="mutedForeground">
                    {dict.order.cashNote}
                  </Text>
                </>
              ) : (
                <Text variant="callout" color="mutedForeground">
                  {dict.order.mapTip}
                </Text>
              )}
            </Stack>
          </Card>
        </Section>

        <Card>
          <Stack gap="md">
            <SwitchField
              label={dict.order.urgentLabel}
              hint={dict.order.urgentPriceNote}
              value={urgent}
              onValueChange={setUrgent}
            />
          </Stack>
        </Card>

        {quote ? (
          <Card>
            <Stack gap="md">
              <SwitchField
                label={dict.order.editPrice}
                hint={fmt(dict.order.priceEditHint, {
                  min: formatDeliveryCash(quote.totalUsd, quote.totalLbp),
                })}
                value={editingPrice}
                onValueChange={(next) => {
                  setEditingPrice(next);
                  setTypedPrice(next ? quote.totalUsd.toFixed(2) : "");
                }}
              />
              {editingPrice ? (
                <Field
                  label={dict.order.raisePrice}
                  value={typedPrice}
                  onChangeText={setTypedPrice}
                  keyboardType="decimal-pad"
                  prefix={
                    <Text variant="body" color="mutedForeground">
                      $
                    </Text>
                  }
                  error={
                    priceIssue === "below_quote"
                      ? fmt(dict.order.priceBelowQuote, {
                          min: formatDeliveryCash(quote.totalUsd, quote.totalLbp),
                        })
                      : priceIssue === "invalid"
                        ? dict.order.priceInvalid
                        : undefined
                  }
                  hint={dict.order.quotedPrice}
                />
              ) : null}
            </Stack>
          </Card>
        ) : null}

        {urgent ? (
          <Row gap="sm">
            <Zap size={16} color={colors.destructive} />
            <Text variant="caption" color="destructive" style={{ flex: 1 }}>
              {dict.order.urgentPriceNote}
            </Text>
          </Row>
        ) : null}
      </Screen>

      <LocationPicker
        open={picking != null}
        onClose={() => setPicking(null)}
        onPick={(picked) => (picking === "pickup" ? setPickup(picked) : setDropoff(picked))}
        title={picking === "pickup" ? dict.order.setPickup : dict.order.setDropoff}
        initial={picking === "pickup" ? pickup : dropoff}
      />
    </>
  );
}
