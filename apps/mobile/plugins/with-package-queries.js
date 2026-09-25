const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Declare the other apps this one is allowed to see.
 *
 * Android 11 (API 30) made the installed-app list private. A package we have
 * not declared here is invisible: `getLaunchIntentForPackage` returns null,
 * `canOpenURL` answers false for its schemes, and
 * `IntentLauncher.openApplication` fails — all as if the app were not
 * installed, even while the driver is looking at its icon on their home screen.
 *
 * Expo's app config has no `android.queries` field, so this small plugin writes
 * the block into AndroidManifest.xml at prebuild time. It is a *visibility*
 * declaration, not a permission: it grants nothing beyond being able to find
 * and launch the named packages, and the user sees no prompt.
 *
 * It has no effect in Expo Go, which ships Expo's own manifest — so a build is
 * what proves this works.
 */
const VISIBLE_PACKAGES = [
  // Whish Money. The driver pays Direct with a Whish → Whish transfer, and the
  // pay sheet opens their app by this package name rather than guessing at a
  // URL scheme Whish has never published.
  "money.whish.android",
];

module.exports = function withPackageQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // The manifest may already carry a <queries> block (another plugin, or the
    // Expo template). Merge into the first one rather than adding a second —
    // Android accepts only one.
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});

    const block = manifest.queries[0];
    if (!Array.isArray(block.package)) block.package = [];

    for (const name of VISIBLE_PACKAGES) {
      const already = block.package.some((entry) => entry?.$?.["android:name"] === name);
      if (!already) block.package.push({ $: { "android:name": name } });
    }

    return cfg;
  });
};
