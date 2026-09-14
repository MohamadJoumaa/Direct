import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import type { LatLng } from "@direct/shared";

import { useAuth } from "@/lib/auth-context";
import { BEIRUT } from "@/lib/maps";
import { startBackgroundLocation, stopBackgroundLocation } from "@/lib/location-task";
import { useStore } from "@/lib/store-context";

export type LocationMode = "off" | "live" | "demo";

/**
 * Live position for the signed-in driver.
 *
 * Gated on `effectiveRole === "driver"`, not on a driver row existing: every
 * admin carries a synthetic `owner` driver row, and watching GPS while an admin
 * browses as a client would be both wrong and a battery leak. Same rule as the
 * website's `useDriverGeolocation`.
 */
export function useDriverLocation() {
  const { effectiveRole, driver, user } = useAuth();
  const { updateLocation } = useStore();
  const [mode, setMode] = useState<LocationMode>("off");
  const [position, setPosition] = useState<LatLng | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const updateRef = useRef(updateLocation);
  updateRef.current = updateLocation;

  const isDriver = effectiveRole === "driver";
  const online = Boolean(driver?.is_online);
  const driverId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function stop() {
      watcher.current?.remove();
      watcher.current = null;
      await stopBackgroundLocation();
      if (!cancelled) {
        setMode("off");
        setPosition(null);
      }
    }

    async function start(id: string) {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (permission.status !== "granted") {
        // Denied: fall back to the Beirut demo pin so the driver can still be
        // dispatched and test the flow, exactly as the website does.
        setMode("demo");
        setPosition(BEIRUT);
        updateRef.current(id, BEIRUT.lat, BEIRUT.lng);
        return;
      }

      setMode("live");
      // Background is best-effort: refusing "always" costs updates with the
      // screen off, not the ability to work.
      void startBackgroundLocation(id);

      watcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8_000,
          distanceInterval: 25,
        },
        (fix) => {
          const point = { lat: fix.coords.latitude, lng: fix.coords.longitude };
          setPosition(point);
          updateRef.current(id, point.lat, point.lng);
        },
      );
    }

    if (isDriver && online && driverId) void start(driverId);
    else void stop();

    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [isDriver, online, driverId]);

  return { mode, position };
}

/** One-shot position for going online, where a fix is needed before the watch. */
export async function readCurrentPosition(): Promise<LatLng | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return null;
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: fix.coords.latitude, lng: fix.coords.longitude };
  } catch {
    return null;
  }
}
