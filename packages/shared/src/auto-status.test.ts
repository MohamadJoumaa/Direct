import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GEOFENCE_EXIT_KM,
  GEOFENCE_RADIUS_KM,
  nextAutoStatus,
  stopsAreDistinguishable,
} from "./auto-status.ts";

/** Roughly metres north of a point, which is enough for a geofence test. */
function north(from: { lat: number; lng: number }, metres: number) {
  return { lat: from.lat + metres / 111_000, lng: from.lng };
}

const PICKUP = { lat: 33.8938, lng: 35.5018 };
const DROPOFF = { lat: 33.9138, lng: 35.5018 };

test("a driver reaching the pickup marks the order picked up", () => {
  assert.equal(
    nextAutoStatus({ status: "accepted", pickup: PICKUP, dropoff: DROPOFF, driver: north(PICKUP, 50) }),
    "picked_up",
  );
  // Still on the way: nothing happens.
  assert.equal(
    nextAutoStatus({ status: "accepted", pickup: PICKUP, dropoff: DROPOFF, driver: north(PICKUP, 400) }),
    null,
  );
});

test("leaving the pickup is what starts the transit leg", () => {
  // Waiting at the shop — not in transit yet.
  assert.equal(
    nextAutoStatus({ status: "picked_up", pickup: PICKUP, dropoff: DROPOFF, driver: north(PICKUP, 60) }),
    null,
  );
  // Inside the hysteresis gap: still nothing, which is the point of the gap.
  assert.equal(
    nextAutoStatus({ status: "picked_up", pickup: PICKUP, dropoff: DROPOFF, driver: north(PICKUP, 200) }),
    null,
  );
  assert.equal(
    nextAutoStatus({ status: "picked_up", pickup: PICKUP, dropoff: DROPOFF, driver: north(PICKUP, 400) }),
    "in_transit",
  );
});

test("reaching the drop-off marks arrived, and nothing goes further", () => {
  assert.equal(
    nextAutoStatus({ status: "in_transit", pickup: PICKUP, dropoff: DROPOFF, driver: north(DROPOFF, 40) }),
    "arrived",
  );
  // `arrived` maps to awaiting_confirmation; the handshake is never automatic.
  assert.equal(
    nextAutoStatus({
      status: "awaiting_confirmation",
      pickup: PICKUP,
      dropoff: DROPOFF,
      driver: DROPOFF,
    }),
    null,
  );
  assert.equal(
    nextAutoStatus({ status: "completed", pickup: PICKUP, dropoff: DROPOFF, driver: DROPOFF }),
    null,
  );
});

test("one step per call, so no transition is ever skipped", () => {
  // Sitting on the drop-off with the order still only accepted: the pickup
  // step is what is owed, not the arrival.
  assert.equal(
    nextAutoStatus({ status: "accepted", pickup: PICKUP, dropoff: DROPOFF, driver: DROPOFF }),
    null,
  );
});

test("no fix, a bad fix, or a warehouse run advances nothing", () => {
  assert.equal(
    nextAutoStatus({ status: "accepted", pickup: PICKUP, dropoff: DROPOFF, driver: null }),
    null,
  );
  assert.equal(
    nextAutoStatus({
      status: "accepted",
      pickup: PICKUP,
      dropoff: DROPOFF,
      driver: { lat: Number.NaN, lng: 35.5 },
    }),
    null,
  );
  assert.equal(
    nextAutoStatus({
      status: "accepted",
      pickup: PICKUP,
      dropoff: DROPOFF,
      driver: PICKUP,
      isLongDistance: true,
    }),
    null,
  );
});

test("stops too close together are left to the driver", () => {
  assert.equal(stopsAreDistinguishable(PICKUP, DROPOFF), true);
  assert.equal(stopsAreDistinguishable(PICKUP, north(PICKUP, 100)), false);
  assert.equal(GEOFENCE_RADIUS_KM < GEOFENCE_EXIT_KM, true);
});
