/**
 * Web binding for the shared application state.
 *
 * The state itself — types, seed, migrations and every mutation — now lives in
 * `@direct/core` so Expo runs the identical logic. All that is left here is the
 * web's persistence: `localStorage`. Pages keep importing `@/lib/demo-store`,
 * so this file is re-exported wholesale.
 */
import { STORAGE_KEY, parseState, seed, serializeState, type DemoState } from "@direct/core";

export * from "@direct/core";

export function loadState(): DemoState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORAGE_KEY, serializeState(s));
      return s;
    }
    return parseState(raw);
  } catch {
    return seed();
  }
}

export function saveState(state: DemoState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, serializeState(state));
}

export function resetDemo() {
  const s = seed();
  saveState(s);
  return s;
}
