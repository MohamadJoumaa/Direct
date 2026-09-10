import { haversineKm } from "@direct/shared";

export type LatLng = { lat: number; lng: number };

export type DriverRoutePoint = LatLng & { id: string };

export type DriverLeg = {
  driverId: string;
  toPickupKm: number;
  toDropoffKm: number;
};

const CACHE_TTL_MS = 45_000;
const MATRIX_BATCH = 25;

type CacheEntry = { km: number; at: number };
const routeCache = new Map<string, CacheEntry>();

function cacheKey(from: LatLng, to: LatLng): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

function cachedKm(from: LatLng, to: LatLng): number | null {
  const hit = routeCache.get(cacheKey(from, to));
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    routeCache.delete(cacheKey(from, to));
    return null;
  }
  return hit.km;
}

function rememberKm(from: LatLng, to: LatLng, km: number) {
  routeCache.set(cacheKey(from, to), { km, at: Date.now() });
}

function mapsMatrixReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof google !== "undefined" &&
    Boolean(google.maps?.DistanceMatrixService) &&
    Boolean(google.maps?.TravelMode?.DRIVING)
  );
}

function haversinePair(from: LatLng, to: LatLng): number {
  return haversineKm(from.lat, from.lng, to.lat, to.lng);
}

function readMatrixKm(
  response: google.maps.DistanceMatrixResponse,
  originIndex: number,
  destIndex: number,
): number | null {
  const row = response.rows[originIndex];
  const cell = row?.elements[destIndex];
  if (!cell || cell.status !== "OK" || cell.distance?.value == null) return null;
  return cell.distance.value / 1000;
}

async function matrixKm(origins: LatLng[], destinations: LatLng[]): Promise<(number | null)[][]> {
  if (!mapsMatrixReady() || origins.length === 0 || destinations.length === 0) {
    return origins.map((from) => destinations.map((to) => haversinePair(from, to)));
  }

  const service = new google.maps.DistanceMatrixService();
  const grid: (number | null)[][] = origins.map(() => destinations.map(() => null));

  for (let o = 0; o < origins.length; o += MATRIX_BATCH) {
    const originSlice = origins.slice(o, o + MATRIX_BATCH);
    for (let d = 0; d < destinations.length; d += MATRIX_BATCH) {
      const destSlice = destinations.slice(d, d + MATRIX_BATCH);
      try {
        const response = await service.getDistanceMatrix({
          origins: originSlice.map((p) => ({ lat: p.lat, lng: p.lng })),
          destinations: destSlice.map((p) => ({ lat: p.lat, lng: p.lng })),
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
        });
        for (let i = 0; i < originSlice.length; i += 1) {
          for (let j = 0; j < destSlice.length; j += 1) {
            grid[o + i][d + j] = readMatrixKm(response, i, j);
          }
        }
      } catch {
        for (let i = 0; i < originSlice.length; i += 1) {
          for (let j = 0; j < destSlice.length; j += 1) {
            grid[o + i][d + j] = haversinePair(originSlice[i], destSlice[j]);
          }
        }
      }
    }
  }

  return grid;
}

/** Driving km when Maps is loaded; haversine otherwise. Shared by fare quotes and dispatch. */
export async function measureRouteKm(from: LatLng, to: LatLng): Promise<number> {
  const hit = cachedKm(from, to);
  if (hit != null) return hit;
  const grid = await matrixKm([from], [to]);
  const km = grid[0]?.[0] ?? haversinePair(from, to);
  rememberKm(from, to, km);
  return km;
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
