import { buildDriverRoute as sharedBuildDriverRoute } from "@direct/core";
import type { RouteStop } from "@direct/shared";
import type { DemoState } from "@/lib/demo-store";
import { prepareStopDistances } from "@/lib/route-distance";

/**
 * Web binding for the shared route sequencer. Only the distance source is
 * web-specific — the ordering rules live in `@direct/core` so Expo sequences a
 * multi-stop run identically.
 */
export function buildDriverRoute(state: DemoState, driverId: string): Promise<RouteStop[]> {
  return sharedBuildDriverRoute(state, driverId, prepareStopDistances);
}
