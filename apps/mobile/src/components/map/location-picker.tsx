import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, type Region as RNRegion } from "react-native-maps";
import * as Location from "expo-location";
import { Crosshair, MapPin, X } from "lucide-react-native";
import type { LatLng } from "@direct/shared";
import { locationLabel } from "@direct/core";

import { Button, IconButton } from "@/components/ui/button";
import { Row, Stack } from "@/components/ui/layout";
import { Text } from "@/components/ui/text";
import { useI18n } from "@/lib/i18n";
import { BEIRUT, fromCoordinate, mapsAvailable, regionAround } from "@/lib/maps";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

export type PickedLocation = LatLng & { label: string };

/**
 * Full-screen place picker.
 *
 * The pin is fixed at the centre of the screen and the map moves under it,
 * rather than asking for a precise tap on a small target -- the pattern every
 * ride-hailing app converged on because it works one-handed and never needs the
 * finger to cover the point being chosen.
 */
export function LocationPicker({
  open,
  onClose,
  onPick,
  title,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedLocation) => void;
  title: string;
  initial?: LatLng | null;
}) {
  const { colors, shadow } = useTheme();
  const { dict, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const start = initial ?? BEIRUT;
  const [centre, setCentre] = useState<LatLng>(start);
  const [locating, setLocating] = useState(false);

  // Re-centre whenever the sheet is reopened for a different field.
  useEffect(() => {
    if (open) setCentre(initial ?? BEIRUT);
  }, [open, initial]);

  const goToMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCentre(point);
      mapRef.current?.animateToRegion(regionAround(point, 1.5), 400);
    } catch {
      // Denied or unavailable: the map simply stays where it is, which is the
      // same outcome the website gives when geolocation is blocked.
    } finally {
      setLocating(false);
    }
  }, []);

  // `locationLabel` never returns raw coordinates: it resolves to the nearest
  // named Lebanese area, or "Pinned location".
  const label = locationLabel(null, centre.lat, centre.lng, lang);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {mapsAvailable() ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={regionAround(start, 2)}
            onRegionChangeComplete={(region: RNRegion) =>
              setCentre(fromCoordinate({ latitude: region.latitude, longitude: region.longitude }))
            }
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.muted, padding: space.lg }}>
            <Text variant="callout" color="mutedForeground">
              {dict.client.mapsMissingKeyMobile}
            </Text>
          </View>
        )}

        {/* Fixed centre pin. Sits above the map, never consumes touches. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MapPin size={38} color={colors.primary} fill={colors.background} />
          {/* Offset so the point of the pin, not its middle, marks the spot. */}
          <View style={{ height: 38 }} />
        </View>

        <View
          style={{
            position: "absolute",
            top: insets.top + space.sm,
            insetInlineStart: space.md,
            insetInlineEnd: space.md,
          }}
        >
          <Row justify="space-between">
            <View
              style={{
                borderRadius: radius.full,
                backgroundColor: colors.card,
                ...shadow("md"),
              }}
            >
              <IconButton accessibilityLabel="Close" onPress={onClose}>
                <X size={20} color={colors.foreground} />
              </IconButton>
            </View>
            <View
              style={{
                borderRadius: radius.full,
                backgroundColor: colors.card,
                ...shadow("md"),
              }}
            >
              <IconButton
                accessibilityLabel={dict.order.useMyLocation}
                onPress={() => void goToMyLocation()}
              >
                <Crosshair
                  size={20}
                  color={locating ? colors.mutedForeground : colors.brand}
                />
              </IconButton>
            </View>
          </Row>
        </View>

        <View
          style={{
            padding: space.md,
            paddingBottom: Math.max(insets.bottom, space.md),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            gap: space.md,
          }}
        >
          <Stack gap="xs">
            <Text variant="label" color="mutedForeground">
              {title}
            </Text>
            <Text variant="subheading" weight="semibold" numberOfLines={2}>
              {label}
            </Text>
          </Stack>
          <Button
            title={dict.common.done}
            size="lg"
            onPress={() => {
              onPick({ ...centre, label });
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Field-shaped button that opens the picker. */
export function LocationField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Stack gap="xs">
      <Text variant="label" weight="medium" color="mutedForeground">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 52,
          paddingHorizontal: space.md,
          paddingVertical: 12,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.input,
          backgroundColor: pressed ? colors.muted : colors.card,
          justifyContent: "center",
        })}
      >
        <Row gap="sm">
          <MapPin size={18} color={value ? colors.foreground : colors.mutedForeground} />
          <Text
            variant="body"
            color={value ? "foreground" : "mutedForeground"}
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </Row>
      </Pressable>
    </Stack>
  );
}
