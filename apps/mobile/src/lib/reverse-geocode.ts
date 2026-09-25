import * as Location from "expo-location";
import { locationLabel } from "@direct/core";
import type { PlaceLang } from "@direct/core";

/**
 * Turning a pin into the name of the place it is actually on.
 *
 * The picker used to call `locationLabel(null, lat, lng)` and nothing else.
 * That helper's coordinate path is a *fallback*: it picks the nearest of the
 * ~23 named areas hard-coded in `place-name.ts`, within 18 km. Twenty-three
 * points do not cover Lebanon, so every village within 18 km of Saida resolved
 * to "Sidon" — the pin was right, the word next to it was the caza. Nothing was
 * wrong with the stored data; only the label was.
 *
 * So ask the device's geocoder first. It is free, needs no key of ours, and
 * knows village names; `locationLabel` stays as the offline floor for a phone
 * with no network, no Play services, or a denied permission.
 *
 * Results are cached by rounded coordinate: dragging the map fires this on
 * every idle, and the geocoders rate-limit hard (iOS throttles at roughly one
 * request per second and starts returning nothing at all).
 */

/**
 * Turn typed text into coordinates.
 *
 * A landmark is how people actually give an address here — "Abou Naji sweets",
 * "Hamra Mall" — so the text is geocoded as given, with ", Lebanon" appended to
 * keep a search for a common name from landing in another country.
 *
 * Returns null when nothing matches, and the caller decides what that means.
 * It must never guess: a fare is computed from this point and a driver is sent
 * to it, so a wrong-by-kilometres coordinate is worse than no coordinate.
 */
export async function geocodeText(text: string): Promise<{ lat: number; lng: number } | null> {
  const query = text.trim();
  if (query.length < 3) return null;
  try {
    const scoped = /lebanon|لبنان/i.test(query) ? query : `${query}, Lebanon`;
    const results = await Location.geocodeAsync(scoped);
    const hit = results[0];
    if (!hit) return null;
    if (!Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
    return { lat: hit.latitude, lng: hit.longitude };
  } catch {
    return null;
  }
}

/** ~11 m. Finer than this and the cache never hits while a thumb is moving. */
const CACHE_PRECISION = 4;

const cache = new Map<string, string>();

function key(lat: number, lng: number): string {
  return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
}

/**
 * Assemble a place name from the geocoder's parts, most specific first.
 *
 * `district` is the village or quarter, `subregion` the caza, `city` the town.
 * We want the first two at most: "Ghazieh, Saida" tells a driver where to go,
 * "Ghazieh, Saida, South Governorate, Lebanon" does not, and a street number
 * on its own is worse than either.
 */
export function composeAddress(parts: Location.LocationGeocodedAddress): string {
  const specific = [parts.district, parts.name, parts.street].find(
    (p) => p && p.trim() && !/^\d+$/.test(p.trim()),
  );
  const area = [parts.city, parts.subregion].find((p) => p && p.trim());

  if (specific && area && specific.trim() !== area.trim()) {
    return `${specific.trim()}, ${area.trim()}`;
  }
  return (specific ?? area ?? parts.region ?? "").trim();
}

/**
 * Best available name for a point. Never returns coordinates, never throws.
 *
 * `fallbackLabel` is what the caller already had (a stored address, say);
 * anything the geocoder gives us beats the nearest-area guess, but a real
 * stored address beats both, which is why it goes through `locationLabel`.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  lang: PlaceLang = "en",
): Promise<string> {
  const cacheKey = key(lat, lng);
  const hit = cache.get(cacheKey);
  if (hit) return locationLabel(hit, lat, lng, lang);

  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const composed = results.length > 0 ? composeAddress(results[0]) : "";
    if (composed) {
      cache.set(cacheKey, composed);
      return locationLabel(composed, lat, lng, lang);
    }
  } catch {
    // No network, no Play services, throttled, or permission denied. The
    // offline floor below is exactly what the app showed before, so this is a
    // silent degrade rather than a failure the driver has to read about.
  }

  return locationLabel(null, lat, lng, lang);
}
