import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { LatLng } from "@direct/shared";

/** Beirut. The same fallback centre the website uses when nothing is known. */
export const BEIRUT: LatLng = { lat: 33.8938, lng: 35.5018 };

/**
 * True while the JS is running inside the Expo Go sandbox rather than a build
 * of our own.
 *
 * `appOwnership` is the historical signal and `executionEnvironment` the
 * current one; SDK versions disagree about which is populated, so both are
 * consulted and either one is enough.
 */
export function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo"
  );
}

/**
 * Whether **Google/Apple** maps can be rendered here.
 *
 *  - iOS uses Apple Maps, which needs no key of ours. Always true.
 *  - **Android in Expo Go: false, always.** An earlier version of this returned
 *    true, on Expo's documented claim that Expo Go needs no setup for
 *    react-native-maps. On SDK 57 that is not what happens: Expo Go ships no
 *    usable Google Maps key, and `PROVIDER_GOOGLE` renders a solid black
 *    rectangle with the controls drawn on top of it. Our own key cannot help —
 *    it is native config, and native config only reaches a binary we built.
 *    Returning true here turned a readable fallback into a black screen.
 *  - A dev-client or store build on Android needs our key; without it the map
 *    is blank, which is worse than not drawing one.
 *
 * False does not mean "no map": `OpenStreetMapPicker` needs no key on any
 * platform and is what the location picker falls back to. This function only
 * answers for the native map.
 */
export function mapsAvailable(): boolean {
  if (Platform.OS === "ios") return true;
  if (Platform.OS === "android" && isExpoGo()) return false;
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").length > 0;
}

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function toCoordinate(p: LatLng) {
  return { latitude: p.lat, longitude: p.lng };
}

export function fromCoordinate(c: { latitude: number; longitude: number }): LatLng {
  return { lat: c.latitude, lng: c.longitude };
}

/** A region centred on one point, roughly `km` across. */
export function regionAround(point: LatLng, km = 3): Region {
  const latitudeDelta = km / 111;
  return {
    latitude: point.lat,
    longitude: point.lng,
    latitudeDelta,
    // Longitude degrees shrink with latitude; without this the view is
    // noticeably squashed east-west in Lebanon.
    longitudeDelta: latitudeDelta / Math.cos((point.lat * Math.PI) / 180),
  };
}

/** Smallest region containing every point, with breathing room at the edges. */
export function regionForPoints(points: LatLng[], padding = 1.6): Region {
  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (usable.length === 0) return regionAround(BEIRUT, 8);
  if (usable.length === 1) return regionAround(usable[0]);

  const lats = usable.map((p) => p.lat);
  const lngs = usable.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // A floor keeps two near-identical pins from zooming to street level.
    latitudeDelta: Math.max((maxLat - minLat) * padding, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * padding, 0.01),
  };
}
