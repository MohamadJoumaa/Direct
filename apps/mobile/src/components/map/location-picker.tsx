import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { PROVIDER_GOOGLE, type Region as RNRegion } from "react-native-maps";
import * as Location from "expo-location";
import { Crosshair, MapPin, X } from "lucide-react-native";
import type { LatLng } from "@direct/shared";
import { locationLabel } from "@direct/core";

import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Text } from "@/components/ui/text";
import { DirectionRoot, useI18n } from "@/lib/i18n";
import { BEIRUT, fromCoordinate, mapsAvailable, regionAround } from "@/lib/maps";
import { OpenStreetMapPicker, type OpenStreetMapPickerHandle } from "./osm-picker";
import { reverseGeocode } from "@/lib/reverse-geocode";
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
  const osmRef = useRef<OpenStreetMapPickerHandle | null>(null);

  const start = initial ?? BEIRUT;
  const [centre, setCentre] = useState<LatLng>(start);
  /**
   * Whether the MapView may mount yet.
   *
   * A `MapView` created in the same frame as its `Modal` renders as a solid
   * black rectangle on Android: the surface is attached before the modal's
   * window has been laid out, the map gets a zero-sized surface, and it never
   * redraws once the window settles. Waiting one frame past the open animation
   * gives it a window with real dimensions to attach to — which is why the
   * same component draws fine on the order screens and only broke here, where
   * it lives inside a Modal.
   */
  const [mapReady, setMapReady] = useState(false);
  /**
   * Nudged by one pixel after the map reports itself ready.
   *
   * The second half of the same Android bug: even with a correct surface, the
   * tiles sometimes do not paint until the view's size changes. A one-pixel
   * margin that is applied and then removed forces exactly one relayout, which
   * is enough, and is invisible.
   */
  const [nudge, setNudge] = useState(1);
  const [locating, setLocating] = useState(false);
  /** Name of the point under the pin, once the geocoder has answered. */
  const [resolved, setResolved] = useState<string | null>(null);

  // Re-centre whenever the sheet is reopened for a different field.
  useEffect(() => {
    if (open) {
      setCentre(initial ?? BEIRUT);
      setResolved(null);
    }
  }, [open, initial]);

  // Mount the map a beat after the modal opens, and tear it down on close so
  // the next open starts from the same known-good sequence.
  useEffect(() => {
    if (!open) {
      setMapReady(false);
      setNudge(1);
      return;
    }
    const timer = setTimeout(() => setMapReady(true), 300);
    return () => clearTimeout(timer);
  }, [open]);

  /**
   * Ask the device what is under the pin.
   *
   * Debounced, and only after the map settles: `onRegionChangeComplete` fires
   * on every flick, and both platform geocoders throttle to roughly one call a
   * second before they start answering with nothing. The stale-guard matters
   * as much — a slow answer for a point the thumb has already left would
   * overwrite the name of where the pin actually is.
   */
  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(() => {
      void reverseGeocode(centre.lat, centre.lng, lang).then((name) => {
        if (current) setResolved(name);
      });
    }, 450);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, centre.lat, centre.lng, lang]);

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
      // Whichever map is actually on screen.
      mapRef.current?.animateToRegion(regionAround(point, 1.5), 400);
      osmRef.current?.setCentre(point, 16);
    } catch {
      // Denied or unavailable: the map simply stays where it is, which is the
      // same outcome the website gives when geolocation is blocked.
    } finally {
      setLocating(false);
    }
  }, []);

  // The geocoder's answer when it has one, and the nearest-named-area floor
  // until then — `locationLabel` never returns raw coordinates either way.
  // The pin's coordinates are what gets saved; this is only what it is called.
  const label = resolved ?? locationLabel(null, centre.lat, centre.lng, lang);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Own root, own direction — the close and locate buttons are positioned
          with `insetInlineStart`/`End` and would otherwise mirror by whatever
          the last launch wrote into the native flag. */}
      <DirectionRoot style={{ backgroundColor: colors.background }}>
        {mapsAvailable() ? (
          mapReady ? (
            <MapView
              ref={mapRef}
              style={{ flex: 1, marginBottom: nudge }}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              initialRegion={regionAround(start, 2)}
              onMapReady={() => setNudge(0)}
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
            // The one frame before the map mounts. A plain surface rather than
            // a spinner: the map appears almost immediately and a spinner that
            // flashes for 300ms reads as a stall.
            <View style={{ flex: 1, backgroundColor: colors.muted }} />
          )
        ) : (
          // No Google/Apple map here — Expo Go on Android, or a build without
          // our key. OpenStreetMap needs neither, so the driver still gets a
          // real map to drag rather than a apology and a dead end.
          <OpenStreetMapPicker
            initial={start}
            onCentreChange={setCentre}
            handleRef={osmRef}
          />
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
      </DirectionRoot>
    </Modal>
  );
}

/**
 * How a client says where something is.
 *
 * Two inputs and a map button, because in Lebanon an address often is not a
 * street and a number — it is "Abou Naji sweets, next to the mosque". Asking
 * only for a pin assumed a map the phone can draw, which on Expo Go it cannot;
 * asking only for text loses the coordinates the fare and the dispatch ring are
 * both measured from. So: type the landmark, add the detail that gets a driver
 * to the door, and drop a pin when you can.
 *
 * The typed landmark is geocoded by the caller; the note is never geocoded and
 * never has to be — it is written for a person, and it travels to the driver
 * as written.
 */
export function LocationField({
  label,
  value,
  placeholder,
  note,
  notePlaceholder,
  hint,
  resolving,
  onChangeText,
  onChangeNote,
  onPressMap,
}: {
  label: string;
  /** The typed landmark, or the label of a dropped pin. */
  value: string;
  placeholder: string;
  /** Free text describing the exact spot. */
  note: string;
  notePlaceholder: string;
  /** One line telling the user how the two fields are used. */
  hint?: string;
  /** True while the typed text is being turned into coordinates. */
  resolving?: boolean;
  onChangeText: (next: string) => void;
  onChangeNote: (next: string) => void;
  onPressMap: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Stack gap="xs">
      <Field
        label={label}
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
        suffix={
          resolving ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            // The map is the precise option, offered beside the quick one
            // rather than instead of it.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={onPressMap}
              hitSlop={10}
            >
              <MapPin size={20} color={colors.brand} />
            </Pressable>
          )
        }
      />
      <Field
        value={note}
        placeholder={notePlaceholder}
        onChangeText={onChangeNote}
        multiline
      />
      {hint ? (
        <Text variant="caption" color="mutedForeground">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
