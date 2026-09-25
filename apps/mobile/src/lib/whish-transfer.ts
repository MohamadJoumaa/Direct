import { Linking, Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

/**
 * Handing the driver off to the Whish app for a Whish → Whish transfer.
 *
 * Whish publishes no documented deep link that pre-fills a transfer, and no
 * public API that can read a P2P transfer back. That shapes everything here:
 *
 *  - we can *open* the app, we cannot pre-fill it, so the number and the
 *    amount go to the clipboard and the screen spells out the three taps;
 *  - nothing this module returns is payment proof. "The app opened" is the
 *    strongest fact available, and `payment-rules.md` is explicit that opening
 *    a pay surface unlocks nothing. Confirmation is an admin's job.
 *
 * If Whish ever ships a collect API our merchant account can use, the right
 * move is to go back to `src/lib/whish.ts` (kept, parked) rather than to try to
 * verify a transfer from here.
 */

/** Play Store id, from the app's listing. */
export const WHISH_ANDROID_PACKAGE = "money.whish.android";
/** App Store id, from the app's listing. */
export const WHISH_IOS_APP_ID = "1284243483";

/**
 * Whish's own web link.
 *
 * Tested on a phone with Whish installed: it opens the **web page**, not the
 * app. So Whish has not published the App Links / Universal Links association
 * their domain would need, and this link is a web page and nothing more.
 *
 * It is therefore the last resort on iOS only, and never used on Android,
 * where `openApplication` below does the job properly.
 */
export const WHISH_WEB_URL = "https://www.whish.money/send-receive";

/**
 * Schemes to try, best guess first.
 *
 * None of these is documented, which is exactly why there are three and why
 * failure is expected rather than exceptional: every one of them can throw and
 * the store fallback below still gets the driver somewhere useful. iOS needs
 * each scheme listed in `LSApplicationQueriesSchemes` (app.json) before
 * `canOpenURL` will even answer honestly about it.
 */
export const WHISH_APP_SCHEMES = ["whish://", "whishmoney://", "whishmoney.app://"] as const;

export type WhishOpenResult = "app" | "web" | "failed";

/**
 * Is this package installed and visible to us?
 *
 * `getApplicationIconAsync` is the probe rather than anything named "is
 * installed", because it is the only call in this module documented to answer
 * quietly — an empty string when the icon cannot be retrieved — instead of
 * throwing. Both failure modes we care about land on an empty string: the app
 * is not installed, or it is installed but invisible because the `<queries>`
 * entry is missing from this build.
 */
async function isAndroidPackageInstalled(packageName: string): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    const icon = await IntentLauncher.getApplicationIconAsync(packageName);
    return typeof icon === "string" && icon.length > 0;
  } catch {
    return false;
  }
}

/**
 * Launch Whish on Android by package name.
 *
 * This is the route that actually works, and it needs no URL scheme at all: a
 * package name is a permanent identifier, published on the Play Store listing,
 * and the OS resolves the app's launcher activity from it wherever the user has
 * buried the icon. Whish having published no deep link stops mattering.
 *
 * The probe comes first because `openApplication` is **synchronous and returns
 * void** — it reports nothing about whether it worked. Trusting it alone would
 * mean returning "opened" for a phone without Whish, and the driver would tap
 * Pay and watch nothing happen with no fallback offered. So: ask whether the
 * package is there, and only treat the launch as success when it is. The
 * unguarded attempt afterwards costs nothing and covers a probe that fails for
 * some reason of its own on a phone that does have the app.
 *
 * Requires the `<queries>` entry from `plugins/with-package-queries.js`, so it
 * works in a build; in Expo Go it depends on Expo Go's own manifest.
 */
async function openAndroidPackage(packageName: string): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  const installed = await isAndroidPackageInstalled(packageName);
  try {
    IntentLauncher.openApplication(packageName);
    return installed;
  } catch {
    // Native threw: the launcher activity could not be resolved.
    return false;
  }
}

/**
 * Only ever reached from the explicit "Don't have Whish?" affordance, never as
 * a fallback: a driver who is mid-payment and sees a store listing assumes the
 * app they are holding is broken.
 */
export function whishStoreUrl(): string {
  return Platform.OS === "ios"
    ? `https://apps.apple.com/app/id${WHISH_IOS_APP_ID}`
    : `https://play.google.com/store/apps/details?id=${WHISH_ANDROID_PACKAGE}`;
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hand the driver to Whish.
 *
 * Two platforms, two different truths.
 *
 * **Android** opens the app by package name and stops there. It does not fall
 * back to the web page, because that is precisely the failure being fixed: a
 * driver with Whish on their home screen tapped "Pay" and got a web page. If
 * the package will not launch, the app genuinely is not installed (or the
 * `<queries>` entry is missing from the build), and the honest answer is to
 * keep the driver in the sheet with the number and amount on the clipboard
 * rather than to open something that is not Whish.
 *
 * **iOS** has no equivalent. Apple does not let one app launch another by
 * bundle id, so the only routes are a custom URL scheme — which Whish has never
 * published — or a Universal Link, which their domain turns out not to carry.
 * So the schemes are tried on the chance one is right, the web page is the last
 * resort, and iOS is knowingly the weaker of the two until Whish tells us a
 * scheme.
 *
 * `canOpenURL` is asked first but never trusted as a negative: on Android 11+
 * it answers false for any scheme missing from `<queries>`, while `openURL` on
 * the same scheme still launches the app — package visibility restricts
 * *querying*, not an implicit VIEW intent.
 */
export async function openWhishApp(): Promise<WhishOpenResult> {
  if (await openAndroidPackage(WHISH_ANDROID_PACKAGE)) return "app";

  for (const scheme of WHISH_APP_SCHEMES) {
    try {
      if (await Linking.canOpenURL(scheme)) {
        if (await tryOpen(scheme)) return "app";
      }
    } catch {
      // canOpenURL itself throws on iOS for an unlisted scheme. Keep going.
    }
  }

  for (const scheme of WHISH_APP_SCHEMES) {
    if (await tryOpen(scheme)) return "app";
  }

  // Android deliberately stops here: a web page is not Whish, and pretending
  // otherwise is the bug this replaced.
  if (Platform.OS !== "android" && (await tryOpen(WHISH_WEB_URL))) return "web";
  return "failed";
}

/** The explicit "I do not have Whish" path. Only ever user-initiated. */
export async function openWhishStore(): Promise<boolean> {
  return tryOpen(whishStoreUrl());
}

/**
 * Just the digits, which is what the driver has to paste into Whish.
 *
 * Settings hold the number as an admin typed it, so it can carry spaces, a
 * leading +961, or dashes; pasting any of those into Whish's recipient field
 * fails silently and the driver blames us.
 */
export function whishDialNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Lebanese mobile numbers are 8 digits locally; a stored +961 / 00961 prefix
  // is the same number and Whish expects the local form.
  if (digits.length > 8 && digits.startsWith("961")) return digits.slice(3);
  if (digits.length > 8 && digits.startsWith("00961")) return digits.slice(5);
  return digits;
}

/** What the driver has to send, in the form Whish shows amounts. */
export function whishAmountLabel(amountUsd: number): string {
  return `$${amountUsd.toFixed(2)}`;
}

/** What goes on the clipboard for the amount field: digits only. */
export function whishAmountValue(amountUsd: number): string {
  return amountUsd.toFixed(2);
}
