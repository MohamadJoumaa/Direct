export type LatLng = { lat: number; lng: number };

export type RouteStop = {
  id: string;
  orderId: string;
  kind: "pickup" | "dropoff";
  lat: number;
  lng: number;
};

function point(s: RouteStop): LatLng {
  return { lat: s.lat, lng: s.lng };
}

function totalDistance(
  start: LatLng,
  seq: RouteStop[],
  distance: (a: LatLng, b: LatLng) => number,
): number {
  if (seq.length === 0) return 0;
  let d = distance(start, point(seq[0]));
  for (let i = 1; i < seq.length; i += 1) {
    d += distance(point(seq[i - 1]), point(seq[i]));
  }
  return d;
}

/**
 * Orders stops so every pickup precedes its own drop-off, minimising distance.
 * `distance` is injected: driving km when Maps is up, haversine otherwise.
 *
 * Google's `optimizeWaypoints` is deliberately not used here — it reorders
 * freely and would happily schedule a drop-off before its own pickup.
 */
export function sequenceStops(
  start: LatLng,
  stops: RouteStop[],
  distance: (a: LatLng, b: LatLng) => number,
): RouteStop[] {
  if (stops.length <= 1) return [...stops];

  // Orders whose pickup is one of these stops need that pickup visited first.
  // An order with no pickup stop here (already picked up) has no such gate.
  const pickupOrderIds = new Set(
    stops.filter((s) => s.kind === "pickup").map((s) => s.orderId),
  );

  function isEligible(stop: RouteStop, visitedPickups: Set<string>): boolean {
    if (stop.kind === "pickup") return true;
    if (!pickupOrderIds.has(stop.orderId)) return true;
    return visitedPickups.has(stop.orderId);
  }

  // 1) Nearest-neighbour construction, respecting pickup-before-dropoff.
  const remaining = [...stops];
  const built: RouteStop[] = [];
  const visitedPickups = new Set<string>();
  let current = start;
  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestKm = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      if (!isEligible(candidate, visitedPickups)) continue;
      const km = distance(current, point(candidate));
      if (km < bestKm) {
        bestKm = km;
        bestIndex = i;
      }
    }
    // Every order contributes either a pickup (always eligible) or a
    // drop-off with no pickup gate here, so a candidate always exists.
    const [chosen] = remaining.splice(bestIndex, 1);
    if (chosen.kind === "pickup") visitedPickups.add(chosen.orderId);
    built.push(chosen);
    current = point(chosen);
  }

  // 2) 2-opt improvement pass — reject any swap that breaks precedence.
  function respectsPrecedence(seq: RouteStop[]): boolean {
    const pickedAtIndex = new Map<string, number>();
    for (let i = 0; i < seq.length; i += 1) {
      const s = seq[i];
      if (s.kind === "pickup") {
        pickedAtIndex.set(s.orderId, i);
      } else if (pickupOrderIds.has(s.orderId)) {
        const pickedAt = pickedAtIndex.get(s.orderId);
        if (pickedAt == null || pickedAt > i) return false;
      }
    }
    return true;
  }

  let best = built;
  let bestLen = totalDistance(start, best, distance);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).toReversed(),
          ...best.slice(j + 1),
        ];
        if (!respectsPrecedence(candidate)) continue;
        const len = totalDistance(start, candidate, distance);
        if (len + 1e-9 < bestLen) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }

  return best;
}
