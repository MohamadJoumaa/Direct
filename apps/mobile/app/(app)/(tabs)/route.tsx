import React, { useEffect, useMemo, useState } from "react";
import { Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Navigation } from "lucide-react-native";
import type { RouteStop } from "@direct/shared";
import { buildDriverRoute, formatOrderNumber, locationLabel } from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { DeliveryMap, type MapPoint } from "@/components/map/delivery-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { prepareStopDistances } from "@/lib/route-distance";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

/**
 * The driver's sequenced run.
 *
 * `buildDriverRoute` orders every active stop so no drop-off is ever scheduled
 * before its own pickup. Turn-by-turn is handed to the phone's own maps app --
 * it is the tool a driver already trusts, and it keeps working when Direct is
 * in the background.
 */
export default function DriverRoute() {
  const { dict, lang } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { state, refreshFromStorage } = useStore();
  const router = useRouter();
  const [stops, setStops] = useState<RouteStop[]>([]);

  // Re-sequence whenever the orders or the driver's position change.
  const signature = state.orders
    .filter((o) => o.assigned_driver_id === user?.id || o.long_distance_driver_id === user?.id)
    .map((o) => `${o.id}:${o.status}`)
    .join("|");
  const position = state.locations.find((l) => l.driver_id === user?.id);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void buildDriverRoute(state, user.id, prepareStopDistances).then((next) => {
      if (alive) setStops(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, position?.lat, position?.lng, user?.id]);

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = stops.map((stop, index) => ({
      id: stop.id,
      kind: stop.kind === "pickup" ? "pickup" : "dropoff",
      lat: stop.lat,
      lng: stop.lng,
      label: `${index + 1}. ${locationLabel(null, stop.lat, stop.lng, lang)}`,
    }));
    if (position) {
      list.unshift({
        id: "me",
        kind: "driver",
        lat: position.lat,
        lng: position.lng,
        label: dict.common.you,
      });
    }
    return list;
  }, [stops, position, lang, dict.common.you]);

  const next = stops[0];

  return (
    <>
      <AppHeader title={dict.driver.yourRoute} subtitle={user?.full_name} />
      <Screen
        onRefresh={refreshFromStorage}
        footer={
          next ? (
            <Button
              title={dict.driver.navigateNextStop}
              size="lg"
              icon={<Navigation size={18} color={colors.primaryForeground} />}
              onPress={() => void openNavigation(next.lat, next.lng)}
            />
          ) : undefined
        }
      >
        {stops.length === 0 ? (
          <EmptyState title={dict.driver.noActiveJobs} body={dict.driver.noMatching} />
        ) : (
          <>
            <DeliveryMap
              points={points}
              route={[
                ...(position ? [{ lat: position.lat, lng: position.lng }] : []),
                ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
              ]}
              height={240}
            />

            <Stack gap="sm">
              {stops.map((stop, index) => {
                const order = state.orders.find((o) => o.id === stop.orderId);
                return (
                  <Card
                    key={stop.id}
                    onPress={() => router.push(`/orders/${stop.orderId}`)}
                    accessibilityLabel={locationLabel(null, stop.lat, stop.lng, lang)}
                  >
                    <Row gap="md">
                      <Stack
                        align="center"
                        justify="center"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: index === 0 ? colors.primary : colors.secondary,
                        }}
                      >
                        <Text
                          variant="label"
                          weight="bold"
                          numeric
                          style={{
                            color: index === 0 ? colors.primaryForeground : colors.foreground,
                          }}
                        >
                          {index + 1}
                        </Text>
                      </Stack>

                      <Stack gap={4} flex={1}>
                        <Row gap="xs">
                          <Badge
                            label={
                              stop.kind === "pickup" ? dict.common.pickup : dict.common.dropoff
                            }
                            tone={stop.kind === "pickup" ? "brand" : "secondary"}
                          />
                          {order ? (
                            <Text variant="caption" color="mutedForeground" numeric>
                              {formatOrderNumber(order.order_number)}
                            </Text>
                          ) : null}
                        </Row>
                        <Text variant="callout" numberOfLines={2}>
                          {locationLabel(
                            stop.kind === "pickup"
                              ? order?.pickup_address
                              : order?.dropoff_address,
                            stop.lat,
                            stop.lng,
                            lang,
                          )}
                        </Text>
                      </Stack>
                    </Row>
                  </Card>
                );
              })}
            </Stack>
          </>
        )}
      </Screen>
    </>
  );
}

/** Hands the stop to Apple Maps or Google Maps, whichever the platform uses. */
async function openNavigation(lat: number, lng: number) {
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lng}&dirflg=d`,
    default: `google.navigation:q=${lat},${lng}`,
  });
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  try {
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else await Linking.openURL(fallback);
  } catch {
    await Linking.openURL(fallback);
  }
}
