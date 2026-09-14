/**
 * Driving distance from one driver to a single order's two stops.
 *
 * Measured per platform — the web uses the Google Distance Matrix, Expo uses
 * its own native routing — so the shape lives here and dispatch stays a pure
 * function of numbers it was handed.
 */
export type DriverLeg = {
  driverId: string;
  toPickupKm: number;
  toDropoffKm: number;
};
