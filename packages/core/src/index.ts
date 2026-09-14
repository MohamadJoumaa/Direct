/**
 * @direct/core — the Direct application state.
 *
 * Every mutation here is a pure `(state, ...args) => { state, error? }`; nothing
 * in this package performs IO. Persistence belongs to each client's store
 * provider (`localStorage` on web, AsyncStorage in Expo), which is what lets
 * both apps run the identical domain logic and what will let both swap to
 * Supabase by replacing one provider rather than every screen.
 */
export * from "./store";
export * from "./place-name";
export * from "./types";
export { buildDriverRoute, type PrepareDistances } from "./driver-route";

import type { DemoState } from "./store";
import { migrateState, seed } from "./store";

/**
 * Rehydrate a serialized state blob. Anything unreadable falls back to a fresh
 * seed rather than throwing — a corrupt cache must never lock a driver out of
 * the app mid-shift.
 */
export function parseState(raw: string | null | undefined): DemoState {
  if (!raw) return seed();
  try {
    return migrateState(JSON.parse(raw) as DemoState);
  } catch {
    return seed();
  }
}

export function serializeState(state: DemoState): string {
  return JSON.stringify(state);
}
