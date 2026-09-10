import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISPATCH_INITIAL_RADIUS_KM,
  DISPATCH_RADIUS_GROWTH,
  driversInsideRadius,
  expandDispatchRadius,
} from "./dispatch.ts";

test("expandDispatchRadius returns null when no drivers", () => {
  assert.equal(expandDispatchRadius([]), null);
  assert.equal(expandDispatchRadius([-1, Number.NaN]), null);
});

test("expandDispatchRadius keeps 2 km when a driver is already inside", () => {
  const ring = expandDispatchRadius([0.4, 1.9, 8]);
  assert.deepEqual(ring, { radiusKm: DISPATCH_INITIAL_RADIUS_KM, driverCount: 2 });
});

test("expandDispatchRadius grows by 1.5 until someone is inside", () => {
  const first = expandDispatchRadius([2.1]);
  assert.deepEqual(first, {
    radiusKm: DISPATCH_INITIAL_RADIUS_KM * DISPATCH_RADIUS_GROWTH,
    driverCount: 1,
  });

  const second = expandDispatchRadius([3.1]);
  assert.deepEqual(second, {
    radiusKm: DISPATCH_INITIAL_RADIUS_KM * DISPATCH_RADIUS_GROWTH ** 2,
    driverCount: 1,
  });
});

test("expandDispatchRadius includes a driver exactly on the ring", () => {
  const ring = expandDispatchRadius([2]);
  assert.deepEqual(ring, { radiusKm: 2, driverCount: 1 });
});

test("driversInsideRadius ranks by pickup then dropoff", () => {
  const ranked = driversInsideRadius(
    [
      { driverId: "far-pickup", toPickupKm: 1.8, toDropoffKm: 0.2 },
      { driverId: "near", toPickupKm: 0.5, toDropoffKm: 9 },
      { driverId: "tie-closer-drop", toPickupKm: 1.8, toDropoffKm: 0.1 },
      { driverId: "outside", toPickupKm: 4, toDropoffKm: 1 },
    ],
    2,
  );
  assert.deepEqual(
    ranked.map((d) => d.driverId),
    ["near", "tie-closer-drop", "far-pickup"],
  );
});
