import type { DriverType } from "./index";

/** Every driver can hold up to `maxActive` active orders at once. */
export function canAcceptAnotherOrder(
  _driverType: DriverType | undefined,
  activeCount: number,
  maxActive: number,
): boolean {
  return activeCount < maxActive;
}
