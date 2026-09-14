// Layers env-driven native config onto app.json. Map keys must reach the native
// SDKs through `ios.config` / `android.config`, which app.json cannot express
// without committing the key to the repo.
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: { ...config.ios?.config, googleMapsApiKey: mapsKey || undefined },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: mapsKey ? { apiKey: mapsKey } : undefined,
    },
  },
  extra: {
    ...config.extra,
    // Read back through expo-constants where process.env is not inlined.
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? "",
    router: { origin: false },
  },
});
