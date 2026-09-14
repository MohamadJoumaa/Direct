import assert from "node:assert/strict";
import { test } from "node:test";
import { canAcceptAnotherOrder } from "./capacity.ts";

test("canAcceptAnotherOrder compares against the configured cap", () => {
  assert.equal(canAcceptAnotherOrder("fast", 0, 1), true);
  assert.equal(canAcceptAnotherOrder("fast", 1, 1), false);
  assert.equal(canAcceptAnotherOrder("fast", 2, 3), true);
  assert.equal(canAcceptAnotherOrder("fast", 3, 3), false);
  assert.equal(canAcceptAnotherOrder("fast", 4, 3), false);
});

test("canAcceptAnotherOrder ignores driver type — the cap is uniform", () => {
  assert.equal(canAcceptAnotherOrder(undefined, 1, 3), true);
  assert.equal(canAcceptAnotherOrder("owner", 1, 3), true);
});
