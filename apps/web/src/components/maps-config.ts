"use client";

import { useEffect, useState } from "react";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/* Google calls window.gm_authFailure when the key is invalid, restricted, or
   billing is off. Remember the failure for the session so later page loads
   skip Google entirely and render the offline placeholder instead. */
const AUTH_FAILED_KEY = "direct-maps-auth-failed";
let mapsAuthFailed = false;
const authListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  try {
    mapsAuthFailed = window.sessionStorage.getItem(AUTH_FAILED_KEY) === "1";
  } catch {
    // storage unavailable — fall back to per-load detection
  }
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    mapsAuthFailed = true;
    try {
      window.sessionStorage.setItem(AUTH_FAILED_KEY, "1");
    } catch {
      // ignore
    }
    authListeners.forEach((listener) => listener());
  };
}

export function hasMapsKey(): boolean {
  return Boolean(MAPS_KEY);
}

export function getMapsKey(): string | undefined {
  return MAPS_KEY;
}

/** True when a key exists and has not already failed this session. Does not load the SDK. */
export function mapsConfigured(): boolean {
  return Boolean(MAPS_KEY) && !mapsAuthFailed;
}

export function useMapsAuthOk(): boolean {
  // False during SSR and the first client render (so hydration matches),
  // then true after mount unless the key already failed this session.
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!MAPS_KEY || mapsAuthFailed) return;
    // After mount so SSR and the first client paint match.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe maps gate
    setOk(true);
    const listener = () => setOk(false);
    authListeners.add(listener);
    return () => {
      authListeners.delete(listener);
    };
  }, []);
  return ok;
}
