import React, { useMemo, useState } from "react";
import { Linking, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { PackagePlus, Phone, Star } from "lucide-react-native";
import { formatDeliveryCash } from "@direct/shared";
import {
  formatOrderNumber,
  locationLabel,
  ordersForOwner,
  publicDriverInfo,
  type Order,
} from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { DeliveryMap, type MapPoint } from "@/components/map/delivery-map";
import { OrderCard } from "@/components/order-card";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section } from "@/components/ui/card";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius, TOUCH_TARGET } from "@/theme/tokens";

const ACTIVE_STATUSES: Order["status"][] = [
  "pending",
  "accepted",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "arrived",
  "awaiting_confirmation",
];

/**
 * Client and business home.
 *
 * Business shares the client UI, exactly as on the website. The live map sits
 * at the top for the order that is actually moving, because on a phone that is
 * the whole reason the app is open.
 */
export function ClientHome() {
  const { dict, lang } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { state, refreshFromStorage } = useStore();
  const router = useRouter();
  const [confirming, setConfirming] = useState<Order | null>(null);

  const orders = useMemo(
    () => (user ? ordersForOwner(state, user.id) : []),
    [state, user],
  );
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const tracked = active.find((o) => o.status !== "pending") ?? active[0];

  const points = useMemo<MapPoint[]>(() => {
    if (!tracked) return [];
    const list: MapPoint[] = [
      {
        id: "pickup",
        kind: "pickup",
        lat: tracked.pickup_lat,
        lng: tracked.pickup_lng,
        label: locationLabel(tracked.pickup_address, tracked.pickup_lat, tracked.pickup_lng, lang),
      },
      {
        id: "dropoff",
        kind: "dropoff",
        lat: tracked.dropoff_lat,
        lng: tracked.dropoff_lng,
        label: locationLabel(
          tracked.dropoff_address,
          tracked.dropoff_lat,
          tracked.dropoff_lng,
          lang,
        ),
      },
    ];
    // The driver pin only appears once someone has accepted — before that there
    // is no driver to share, and `publicDriverInfo` would not name one either.
    const driverId = tracked.assigned_driver_id ?? tracked.long_distance_driver_id;
    const position = driverId
      ? state.locations.find((l) => l.driver_id === driverId)
      : undefined;
    if (position) {
      list.push({
        id: "driver",
        kind: "driver",
        lat: position.lat,
        lng: position.lng,
        label: dict.common.yourDriver,
      });
    }
    return list;
  }, [tracked, state.locations, lang, dict.common.yourDriver]);

  return (
    <>
      <AppHeader title={dict.client.yourOrders} subtitle={user?.full_name} />
      <Screen onRefresh={refreshFromStorage}>
        {tracked ? (
          <Stack gap="sm">
            <DeliveryMap points={points} height={220} />
            <Text variant="caption" color="mutedForeground">
              {tracked.status === "pending" ? dict.client.followHint : dict.client.trackingHint}
            </Text>
            <DriverStrip order={tracked} />
          </Stack>
        ) : null}

        <Button
          title={dict.nav.newOrder}
          size="lg"
          icon={<PackagePlus size={18} color={colors.primaryForeground} />}
          onPress={() => router.push("/new")}
        />

        {active.length === 0 ? (
          <EmptyState
            title={dict.client.noOngoing}
            body={dict.home.sendPackageBody}
          />
        ) : (
          <Section title={dict.admin.ongoingOrders}>
            <Stack gap="sm">
              {active.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actions={
                    order.status === "awaiting_confirmation" && !order.client_confirmed ? (
                      <Button
                        title={dict.client.confirmAndRate}
                        size="sm"
                        full
                        onPress={() => setConfirming(order)}
                      />
                    ) : undefined
                  }
                />
              ))}
            </Stack>
          </Section>
        )}
      </Screen>

      <ConfirmDeliverySheet order={confirming} onClose={() => setConfirming(null)} />
    </>
  );
}

/** Driver identity + call button, shown only once a driver is linked. */
function DriverStrip({ order }: { order: Order }) {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { state } = useStore();
  const info = publicDriverInfo(state, order);

  if (info.kind === "none") {
    return (
      <Card>
        <Text variant="callout" color="mutedForeground">
          {dict.common.waitingForDriver}
        </Text>
      </Card>
    );
  }

  const name =
    info.kind === "direct"
      ? dict.common.directTeam
      : (info.contact?.full_name ?? dict.common.yourDriver);

  return (
    <Card>
      <Row gap="md">
        <Stack gap={2} flex={1}>
          <Text variant="label" color="mutedForeground">
            {dict.common.driver}
          </Text>
          <Text variant="subheading" weight="semibold" numberOfLines={1}>
            {name}
          </Text>
        </Stack>
        {info.contact?.phone ? (
          <Button
            title={dict.client.callDriver}
            variant="outline"
            size="sm"
            icon={<Phone size={16} color={colors.foreground} />}
            onPress={() => void Linking.openURL(`tel:${info.contact?.phone}`)}
          />
        ) : null}
      </Row>
    </Card>
  );
}

/**
 * Both sides must confirm before an order completes, and the client's half
 * carries the rating — `confirmDelivery` rejects a client confirmation without
 * 1–5 stars, so the button stays disabled until one is picked.
 */
export function ConfirmDeliverySheet({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { confirmDelivery } = useStore();
  const toast = useToast();
  const [stars, setStars] = useState(0);

  function submit() {
    if (!order || !user || stars === 0) return;
    const error = confirmDelivery(order.id, user.id, "client", stars);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(dict.orderStatus.completed);
    setStars(0);
    onClose();
  }

  return (
    <Sheet
      open={order != null}
      onClose={onClose}
      title={dict.client.confirmReceived}
      subtitle={order ? formatOrderNumber(order.order_number) : undefined}
      footer={
        <Button
          title={dict.client.confirmAndRate}
          size="lg"
          disabled={stars === 0}
          onPress={submit}
        />
      }
    >
      <Stack gap="md">
        <Text variant="body">{dict.client.howWasDriver}</Text>
        <Row gap="sm" justify="center">
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${value}`}
              accessibilityState={{ selected: stars >= value }}
              onPress={() => setStars(value)}
              style={({ pressed }) => ({
                width: TOUCH_TARGET + 8,
                height: TOUCH_TARGET + 8,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
                backgroundColor: stars >= value ? colors.goldSoft : colors.secondary,
              })}
            >
              <Star
                size={26}
                color={stars >= value ? colors.gold : colors.mutedForeground}
                fill={stars >= value ? colors.gold : "transparent"}
              />
            </Pressable>
          ))}
        </Row>
        {order ? (
          <Card>
            <Row justify="space-between">
              <Text variant="callout" color="mutedForeground">
                {dict.common.cash}
              </Text>
              <Text variant="callout" weight="semibold" numeric>
                {formatDeliveryCash(order.delivery_fee_usd, order.delivery_fee_lbp)}
              </Text>
            </Row>
          </Card>
        ) : null}
        <Text variant="caption" color="mutedForeground">
          {dict.order.cashNote}
        </Text>
      </Stack>
    </Sheet>
  );
}
