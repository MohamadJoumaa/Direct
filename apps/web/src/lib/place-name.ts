/**
 * Place naming moved to `@direct/core` so Expo resolves labels the same way.
 * Re-exported here because web pages import `@/lib/place-name`.
 */
export {
  localizePlaceName,
  looksLikeCoordinates,
  nearestAreaName,
  nameFromAddressComponents,
  nameFromGeocoderResult,
  nameFromPlace,
  locationLabel,
  type PlaceLang,
} from "@direct/core";
