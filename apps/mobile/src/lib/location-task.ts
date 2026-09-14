import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { STORAGE_KEY, parseState, serializeState, updateLocation } from "@direct/core";

export const LOCATION_TASK = "direct-driver-location";
/** Which driver the background task is reporting for. */
const ACTIVE_DRIVER_KEY = "direct-active-driver";

/**
 * react-native-web has no task runner, and expo-location's web shim omits every
 * background method -- `hasStartedLocationUpdatesAsync` is simply not a function
 * there. The browser preview keeps the foreground watcher, which is all a tab
 * can do anyway, so guard the whole background path rather than each call.
 */
const BACKGROUND_SUPPORTED = Platform.OS !== "web";

/**
 * Background position reporting while a driver is online.
 *
 * The task runs outside React, with no providers and no context, which is
 * exactly why every store mutation is a pure function: it can read the same
 * AsyncStorage blob, apply `updateLocation`, and write it back. When Workstream
 * A lands this becomes a Supabase upsert and the surrounding shape is unchanged.
 */
if (BACKGROUND_SUPPORTED) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    try {
      const driverId = await AsyncStorage.getItem(ACTIVE_DRIVER_KEY);
      if (!driverId) return;
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const next = updateLocation(
        parseState(raw),
        driverId,
        latest.coords.latitude,
        latest.coords.longitude,
      );
      await AsyncStorage.setItem(STORAGE_KEY, serializeState(next));
    } catch {
      // A dropped fix is not worth crashing a background task over; the next one
      // is seconds away, and the foreground watcher also reports while open.
    }
  });
}

export async function rememberActiveDriver(driverId: string | null) {
  if (driverId) await AsyncStorage.setItem(ACTIVE_DRIVER_KEY, driverId);
  else await AsyncStorage.removeItem(ACTIVE_DRIVER_KEY);
}

/**
 * Starts background updates. Returns false when the driver declined the
 * "always" permission -- the app keeps working, it just stops reporting once
 * the screen is off, so the UI has to say so rather than silently degrade.
 *
 * Also false in the browser preview and in Expo Go, which carries no background
 * location module: the foreground watcher still reports while the app is open.
 */
export async function startBackgroundLocation(driverId: string): Promise<boolean> {
  if (!BACKGROUND_SUPPORTED) return false;

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return false;

  await rememberActiveDriver(driverId);

  try {
    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (already) return true;

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      // A scooter in city traffic: often enough for a client to see movement,
      // rarely enough not to flatten the battery over a shift.
      timeInterval: 10_000,
      distanceInterval: 40,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Direct",
        notificationBody: "Sharing your location while you are online.",
        notificationColor: "#2563eb",
      },
    });
    return true;
  } catch {
    // Expo Go ships no background location module, so the call throws rather
    // than returning. Going online must still succeed on the foreground watch.
    return false;
  }
}

export async function stopBackgroundLocation() {
  await rememberActiveDriver(null);
  if (!BACKGROUND_SUPPORTED) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Nothing registered; going offline is still correct.
  }
}
