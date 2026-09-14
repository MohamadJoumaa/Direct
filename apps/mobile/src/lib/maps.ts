import { Platform } from "react-native";
import type { LatLng } from "@direct/shared";

/** Beirut. The same fallback centre the website uses when nothing is known. */
export const BEIRUT: LatLng = { lat: 33.8938, lng: 35.5018 };

/**
 * Whether a real map can be rendered.
 *
 * iOS falls back to Apple Maps, which needs no key of ours, so a map is always
 * available there. Android's `react-native-maps` is Google-only and renders a
 * blank grey tile without a key -- worse than showing nothing -- so the app
 * drops to the offline panel instead, mirroring `useMapsAvailable()` on the web.
 */
export function mapsAvailable(): boolean {
  if (Platform.OS === "ios") return true;
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
