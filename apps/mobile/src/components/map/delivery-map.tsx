import React, { useEffect, useMemo, useRef } from "react";
import { View, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Bike, MapPin, Package, Warehouse } from "lucide-react-native";
import type { LatLng } from "@direct/shared";
import { locationLabel } from "@direct/core";

import { Row, Stack } from "@/components/ui/layout";
import { Text } from "@/components/ui/text";
import { useI18n } from "@/lib/i18n";
import { mapsAvailable, regionForPoints, toCoordinate } from "@/lib/maps";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

export type MapPointKind = "pickup" | "dropoff" | "driver" | "warehouse";

export type MapPoint = LatLng & {
  id: string;
  kind: MapPointKind;
  label?: string;
};

const ICONS = {
  pickup: Package,
  dropoff: MapPin,
  driver: Bike,
  warehouse: Warehouse,
} as const;

/**
 * The shared map panel.
 *
 * Without a usable map provider this degrades to a labelled list of the same
 * points rather than an empty grey rectangle -- the website makes the same
 * trade, and a driver with no key still needs to read where the stops are.
 */
export function DeliveryMap({
  points,
  route,
  height = 260,
  style,
  interactive = true,
}: {
  points: MapPoint[];
  /** Ordered path to draw between stops. */
  route?: LatLng[];
  height?: number;
  style?: ViewStyle;
  interactive?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const { lang } = useI18n();
  const mapRef = useRef<MapView | null>(null);
  const available = mapsAvailable();

  const region = useMemo(() => regionForPoints(points), [points]);

  // Follow the pins as they move (a driver on the road) without fighting a
  // user who is panning: animateToRegion only runs when the set changes.
  const signature = points.map((p) => `${p.id}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (!available || !mapRef.current) return;
    mapRef.current.animateToRegion(region, 450);
  }, [signature, available]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!available) {
    return <OfflineMapPanel points={points} height={height} style={style} />;
  }

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        // Google on Android (the only provider there); Apple Maps on iOS, which
        // needs no key and matches the platform's own look.
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        userInterfaceStyle={scheme}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {route && route.length > 1 ? (
          <Polyline
            coordinates={route.map(toCoordinate)}
            strokeColor={colors.brand}
            strokeWidth={4}
          />
        ) : null}

        {points.map((point) => (
          <Marker
            key={point.id}
            coordinate={toCoordinate(point)}
            title={point.label ?? locationLabel(null, point.lat, point.lng, lang)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MapPinBadge kind={point.kind} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

/** Brand-blue marker chip. The only place blue is used as a fill. */
function MapPinBadge({ kind }: { kind: MapPointKind }) {
  const { colors } = useTheme();
  const Icon = ICONS[kind];
  const bg = kind === "driver" ? colors.brand : colors.primary;
  const fg = kind === "driver" ? colors.brandForeground : colors.primaryForeground;

  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={16} color={fg} />
    </View>
  );
}

function OfflineMapPanel({
  points,
  height,
  style,
}: {
  points: MapPoint[];
  height: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const { dict, lang } = useI18n();

  return (
    <View
      style={[
        {
          minHeight: height,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.muted,
          padding: space.md,
          gap: space.sm,
        },
        style,
      ]}
    >
      <Text variant="caption" color="mutedForeground">
        {dict.client.mapsMissingKeyMobile}
      </Text>
      <Stack gap="sm">
        {points.map((point) => (
          <Row key={point.id} gap="sm">
            <MapPinBadge kind={point.kind} />
            <Text variant="callout" style={{ flex: 1 }} numberOfLines={2}>
              {point.label ?? locationLabel(null, point.lat, point.lng, lang)}
            </Text>
          </Row>
        ))}
      </Stack>
    </View>
  );
}
