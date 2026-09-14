import { haversineKm, type LatLng } from "@direct/shared";
import type { DriverLeg } from "@direct/core";

export type { LatLng };
export type DriverRoutePoint = LatLng & { id: string };

/**
 * Driving distances for fare quotes and dispatch.
 *
 * Mirrors `apps/web/src/lib/route-distance.ts` — same 45s cache, same
 * haversine fallback — but talks to the Distance Matrix REST endpoint rather
 * than the Maps JS SDK, which does not exist on native. Every failure path
 * degrades to haversine rather than throwing: a quote must always be produced,
 * and dispatch must never stall because a network call timed out.
 */
const CACHE_TTL_MS = 45_000;
/** Distance Matrix caps a request at 25 origins, 25 destinations, 100 elements. */
const MAX_ORIGINS = 25;
const MAX_DESTINATIONS = 25;
const MAX_ELEMENTS = 100;
const REQUEST_TIMEOUT_MS = 8_000;

const MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

type CacheEntry = { km: number; at: number };
const routeCache = new Map<string, CacheEntry>();

function apiKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
}

/** Mirrors the website's `useMapsAvailable()`: no key means offline mode. */
export function matrixAvailable(): boolean {
  return apiKey().length > 0;
}

function cacheKey(from: LatLng, to: LatLng): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

function cachedKm(from: LatLng, to: LatLng): number | null {
  const key = cacheKey(from, to);
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return hit.km;
}

function rememberKm(from: LatLng, to: LatLng, km: number) {
  routeCache.set(cacheKey(from, to), { km, at: Date.now() });
}

function haversinePair(from: LatLng, to: LatLng): number {
  return haversineKm(from.lat, from.lng, to.lat, to.lng);
}

function encode(points: LatLng[]): string {
  return points.map((p) => `${p.lat},${p.lng}`).join("|");
}

type MatrixElement = { status?: string; distance?: { value?: number } };
type MatrixResponse = { status?: string; rows?: { elements?: MatrixElement[] }[] };

async function requestMatrix(
  origins: LatLng[],
  destinations: LatLng[],
): Promise<(number | null)[][] | null> {
  const url =
    `${MATRIX_URL}?origins=${encodeURIComponent(encode(origins))}` +
    `&destinations=${encodeURIComponent(encode(destinations))}` +
    `&mode=driving&units=metric&key=${encodeURIComponent(apiKey())}`;

  // A hung request would freeze the 5s dispatch tick behind it.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: abort.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as MatrixResponse;
    if (body.status !== "OK" || !body.rows) return null;
    return origins.map((_, i) =>
      destinations.map((__, j) => {
        const cell = body.rows?.[i]?.elements?.[j];
        if (!cell || cell.status !== "OK" || cell.distance?.value == null) return null;
        return cell.distance.value / 1000;
      }),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Destinations per request, so origins × destinations stays under the element cap. */
function destinationChunk(originCount: number): number {
  return Math.max(1, Math.min(MAX_DESTINATIONS, Math.floor(MAX_ELEMENTS / originCount)));
}

async function matrixKm(origins: LatLng[], destinations: LatLng[]): Promise<(number | null)[][]> {
  const fallback = () => origins.map((from) => destinations.map((to) => haversinePair(from, to)));
  if (!matrixAvailable() || origins.length === 0 || destinations.length === 0) return fallback();

  const grid: (number | null)[][] = origins.map(() => destinations.map(() => null));

  for (let o = 0; o < origins.length; o += MAX_ORIGINS) {
    const originSlice = origins.slice(o, o + MAX_ORIGINS);
    const step = destinationChunk(originSlice.length);
    for (let d = 0; d < destinations.length; d += step) {
      const destSlice = destinations.slice(d, d + step);
      const result = await requestMatrix(originSlice, destSlice);
      for (let i = 0; i < originSlice.length; i += 1) {
        for (let j = 0; j < destSlice.length; j += 1) {
          grid[o + i][d + j] = result?.[i]?.[j] ?? haversinePair(originSlice[i], destSlice[j]);
        }
      }
    }
  }

  return grid;
}

/** Driving km when a Maps key is configured; haversine otherwise. */
export async function measureRouteKm(from: LatLng, to: LatLng): Promise<number> {
  const hit = cachedKm(from, to);
  if (hit != null) return hit;
  const grid = await matrixKm([from], [to]);
  const km = grid[0]?.[0] ?? haversinePair(from, to);
  rememberKm(from, to, km);
  return km;
}

/** Warm the cache for every stop pair, then expose a sync lookup for sequencing. */
export async function prepareStopDistances(
  points: LatLng[],
): Promise<(a: LatLng, b: LatLng) => number> {
  if (points.length > 1) {
    const grid = await matrixKm(points, points);
    points.forEach((from, i) => {
      points.forEach((to, j) => {
        if (i === j) return;
        const km = grid[i]?.[j];
        if (km != null) rememberKm(from, to, km);
      });
    });
  }
  return (a: LatLng, b: LatLng) => cachedKm(a, b) ?? haversinePair(a, b);
}

export async function measureDriverLegs(
  drivers: DriverRoutePoint[],
  pickup: LatLng,
  dropoff: LatLng,
): Promise<DriverLeg[]> {
  if (drivers.length === 0) return [];

  const missing = drivers.filter(
    (d) => cachedKm(d, pickup) == null || cachedKm(d, dropoff) == null,
  );

  if (missing.length > 0) {
    const [toPickup, toDropoff] = await Promise.all([
      matrixKm(missing, [pickup]),
      matrixKm(missing, [dropoff]),
    ]);
    missing.forEach((driver, i) => {
      const pickupKm = toPickup[i]?.[0] ?? haversinePair(driver, pickup);
      const dropoffKm = toDropoff[i]?.[0] ?? haversinePair(driver, dropoff);
      rememberKm(driver, pickup, pickupKm);
      rememberKm(driver, dropoff, dropoffKm);
    });
  }

  return drivers.map((driver) => ({
    driverId: driver.id,
    toPickupKm: cachedKm(driver, pickup) ?? haversinePair(driver, pickup),
    toDropoffKm: cachedKm(driver, dropoff) ?? haversinePair(driver, dropoff),
  }));
}
