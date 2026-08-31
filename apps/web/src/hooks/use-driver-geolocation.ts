"use client";

import { useEffect, useRef } from "react";
import { haversineKm } from "@direct/shared";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";

const MIN_INTERVAL_MS = 8000;
const MIN_MOVE_KM = 0.025;

/** Broadcast GPS while the signed-in driver is online, on any screen. */
export function useDriverGeolocation() {
  const { user, driver } = useAuth();
  const { updateLocation } = useStore();
  const updateRef = useRef(updateLocation);
  updateRef.current = updateLocation;
  const last = useRef<{ t: number; lat: number; lng: number } | null>(null);

  const userId = user?.id;
  const online = Boolean(driver?.is_online);

  useEffect(() => {
    if (!userId || !online) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = Date.now();
        const prev = last.current;
        if (prev) {
          const dt = now - prev.t;
          const dist = haversineKm(prev.lat, prev.lng, lat, lng);
          if (dt < MIN_INTERVAL_MS && dist < MIN_MOVE_KM) return;
        }
        last.current = { t: now, lat, lng };
        updateRef.current(userId, lat, lng);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, online]);
}
