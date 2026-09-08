import type { PendingPush } from "@/lib/demo-store";

/**
 * Device push for drivers.
 *
 * Web stores payloads on `pending_pushes`. When the native app is ready,
 * register the driver's Expo (or FCM) token and send these with:
 *
 *   import * as Notifications from "expo-notifications";
 *   await Notifications.scheduleNotificationAsync({
 *     content: { title, body, data },
 *     trigger: null,
 *   });
 *
 * Production should POST to an edge function that looks up the token and
 * calls Expo's push API — do not send from the browser.
 */
export function pendingPushesForDriver(
  pushes: PendingPush[],
  driverId: string,
): PendingPush[] {
  return pushes.filter((p) => p.user_id === driverId);
}
