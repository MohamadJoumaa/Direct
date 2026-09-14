import assert from "node:assert/strict";
import { test } from "node:test";
import { sequenceStops, type LatLng, type RouteStop } from "./route-plan.ts";

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function precedenceHolds(stops: RouteStop[]): boolean {
  const pickedAt = new Map<string, number>();
  for (let i = 0; i < stops.length; i += 1) {
    const s = stops[i];
    if (s.kind === "pickup") pickedAt.set(s.orderId, i);
  }
  for (let i = 0; i < stops.length; i += 1) {
    const s = stops[i];
    if (s.kind !== "dropoff") continue;
    const pickedIndex = pickedAt.get(s.orderId);
    if (pickedIndex != null && pickedIndex > i) return false;
  }
  return true;
}

test("sequenceStops is stable for empty and single-stop inputs", () => {
  const start = { lat: 0, lng: 0 };
  assert.deepEqual(sequenceStops(start, [], haversine), []);
  const single: RouteStop[] = [
    { id: "a", orderId: "o1", kind: "pickup", lat: 1, lng: 1 },
  ];
  assert.deepEqual(sequenceStops(start, single, haversine), single);
});

test("sequenceStops always visits a pickup before its own drop-off", () => {
  const start = { lat: 33.89, lng: 35.5 };
  const stops: RouteStop[] = [
    { id: "o1-d", orderId: "o1", kind: "dropoff", lat: 33.82, lng: 35.49 },
    { id: "o2-p", orderId: "o2", kind: "pickup", lat: 33.9, lng: 35.51 },
    { id: "o1-p", orderId: "o1", kind: "pickup", lat: 33.895, lng: 35.502 },
    { id: "o2-d", orderId: "o2", kind: "dropoff", lat: 33.86, lng: 35.55 },
  ];
  const result = sequenceStops(start, stops, haversine);
  assert.equal(result.length, stops.length);
  assert.ok(precedenceHolds(result));
  // Every id from the input appears exactly once.
  assert.deepEqual(
    result.map((s) => s.id).toSorted(),
    stops.map((s) => s.id).toSorted(),
  );
});

test("a drop-off with no pickup in the batch (already picked up) has no gate", () => {
  const start = { lat: 0, lng: 0 };
  const stops: RouteStop[] = [
    { id: "o1-d", orderId: "o1", kind: "dropoff", lat: 0.01, lng: 0.01 },
    { id: "o2-p", orderId: "o2", kind: "pickup", lat: 5, lng: 5 },
    { id: "o2-d", orderId: "o2", kind: "dropoff", lat: 5.01, lng: 5.01 },
  ];
  const result = sequenceStops(start, stops, haversine);
  assert.ok(precedenceHolds(result));
  // The already-picked-up drop-off (o1-d) is nearest to start, so it should
  // come first rather than waiting behind an unrelated pickup far away.
  assert.equal(result[0].id, "o1-d");
});

test("figure-of-eight: crossing pickups/drop-offs beat the naive sequential order", () => {
  // Two orders laid out so visiting p1,d1,p2,d2 in input order crosses paths,
  // while a smarter (precedence-respecting) order is shorter.
  const start = { lat: 0, lng: 0 };
  const stops: RouteStop[] = [
    { id: "p1", orderId: "o1", kind: "pickup", lat: 0, lng: 10 },
    { id: "d1", orderId: "o1", kind: "dropoff", lat: 10, lng: 0 },
    { id: "p2", orderId: "o2", kind: "pickup", lat: 10, lng: 10 },
    { id: "d2", orderId: "o2", kind: "dropoff", lat: 0, lng: 0.1 },
  ];
  const naiveLen =
    haversine(start, { lat: stops[0].lat, lng: stops[0].lng }) +
    haversine(stops[0], stops[1]) +
    haversine(stops[1], stops[2]) +
    haversine(stops[2], stops[3]);

  const result = sequenceStops(start, stops, haversine);
  assert.ok(precedenceHolds(result));
  let optimizedLen = haversine(start, result[0]);
  for (let i = 1; i < result.length; i += 1) optimizedLen += haversine(result[i - 1], result[i]);

  assert.ok(
    optimizedLen <= naiveLen + 1e-9,
    `expected optimized route (${optimizedLen}) <= naive route (${naiveLen})`,
  );
});
