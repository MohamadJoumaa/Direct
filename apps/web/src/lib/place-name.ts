import { haversineKm } from "@direct/shared";

const COORD_RE = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}\b/i;

const NAMED_AREAS: { name: string; lat: number; lng: number }[] = [
  { name: "Hamra, Beirut", lat: 33.8959, lng: 35.478 },
  { name: "Ras Beirut", lat: 33.899, lng: 35.472 },
  { name: "Manara, Beirut", lat: 33.901, lng: 35.47 },
  { name: "Verdun, Beirut", lat: 33.875, lng: 35.485 },
  { name: "Mazraa, Beirut", lat: 33.878, lng: 35.503 },
  { name: "Tariq El Jdideh, Beirut", lat: 33.86, lng: 35.503 },
  { name: "Achrafieh, Beirut", lat: 33.8869, lng: 35.5194 },
  { name: "Gemmayzeh, Beirut", lat: 33.895, lng: 35.512 },
  { name: "Mar Mikhael, Beirut", lat: 33.899, lng: 35.527 },
  { name: "Downtown Beirut", lat: 33.8938, lng: 35.5018 },
  { name: "Bourj Hammoud", lat: 33.894, lng: 35.54 },
  { name: "Sin El Fil", lat: 33.87, lng: 35.54 },
  { name: "Jdeideh", lat: 33.89, lng: 35.56 },
  { name: "Beirut Airport area", lat: 33.8208, lng: 35.4883 },
  { name: "Choueifat", lat: 33.81, lng: 35.52 },
  { name: "Jounieh", lat: 33.98, lng: 35.62 },
  { name: "Dbayeh", lat: 33.94, lng: 35.59 },
  { name: "Aley", lat: 33.81, lng: 35.6 },
  { name: "Sidon", lat: 33.56, lng: 35.37 },
  { name: "Tyre", lat: 33.27, lng: 35.2 },
  { name: "Tripoli", lat: 34.43, lng: 35.83 },
  { name: "Zahle", lat: 33.85, lng: 35.9 },
  { name: "Baalbek", lat: 34.0, lng: 36.21 },
];

const GENERIC_LABELS = new Set([
  "pickup",
  "drop-off",
  "dropoff",
  "shop location",
  "warehouse",
  "live",
  "driver",
  "your driver",
  "add warehouse",
]);

export function looksLikeCoordinates(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (COORD_RE.test(trimmed)) return true;
  if (PLUS_CODE_RE.test(trimmed) && !/[a-zA-Z]{3,}\s/.test(trimmed.replace(PLUS_CODE_RE, ""))) {
    return true;
  }
  return false;
}

export function nearestAreaName(lat: number, lng: number): string {
  let best = NAMED_AREAS[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const area of NAMED_AREAS) {
    const km = haversineKm(lat, lng, area.lat, area.lng);
    if (km < bestKm) {
      bestKm = km;
      best = area;
    }
  }
  return bestKm <= 18 ? best.name : "Pinned location";
}

type AddressComponent = { long_name: string; types: string[] };

function componentName(components: AddressComponent[], ...types: string[]): string | undefined {
  return components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;
}

/** Neighborhood / city style name from Google address components. */
export function nameFromAddressComponents(components: AddressComponent[]): string {
  const poi = componentName(
    components,
    "point_of_interest",
    "establishment",
    "premise",
    "airport",
    "park",
  );
  const neighborhood = componentName(
    components,
    "neighborhood",
    "sublocality_level_1",
    "sublocality",
    "colloquial_area",
  );
  const route = componentName(components, "route");
  const locality = componentName(components, "locality", "administrative_area_level_2");
  const area = componentName(components, "administrative_area_level_1");
  const city = locality && locality !== neighborhood ? locality : area;

  if (poi && city) return `${poi}, ${city}`;
  if (poi && neighborhood) return `${poi}, ${neighborhood}`;
  if (neighborhood && city && neighborhood !== city) return `${neighborhood}, ${city}`;
  if (neighborhood) return neighborhood;
  if (route && neighborhood) return `${route}, ${neighborhood}`;
  if (route && city) return `${route}, ${city}`;
  if (locality) return locality;
  if (area) return area;
  return "";
}

function cleanFormattedAddress(value: string): string {
  const withoutPlus = value.replace(PLUS_CODE_RE, "").replace(/^,\s*/, "").trim();
  if (!withoutPlus || looksLikeCoordinates(withoutPlus)) return "";
  const parts = withoutPlus
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !looksLikeCoordinates(p) && !/^\d{4,}$/.test(p));
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0] ?? "";
}

export function nameFromGeocoderResult(result: {
  formatted_address?: string;
  address_components?: AddressComponent[];
}): string {
  const fromComponents = nameFromAddressComponents(result.address_components ?? []);
  if (fromComponents) return fromComponents;
  return cleanFormattedAddress(result.formatted_address ?? "");
}

export function nameFromPlace(place: {
  name?: string;
  formatted_address?: string;
  address_components?: AddressComponent[];
}): string {
  const fromComponents = nameFromAddressComponents(place.address_components ?? []);
  const name = place.name?.trim() ?? "";
  if (name && !looksLikeCoordinates(name) && fromComponents && !fromComponents.startsWith(name)) {
    const city = fromComponents.includes(",")
      ? fromComponents.slice(fromComponents.lastIndexOf(",") + 1).trim()
      : fromComponents;
    if (city && !name.includes(city)) return `${name}, ${city}`;
  }
  if (name && !looksLikeCoordinates(name)) return fromComponents || name;
  if (fromComponents) return fromComponents;
  return cleanFormattedAddress(place.formatted_address ?? "");
}

function isGenericLabel(value: string): boolean {
  return GENERIC_LABELS.has(value.trim().toLowerCase());
}

/** Human location name for UI. Never returns raw coordinates. */
export function locationLabel(
  value: string | undefined | null,
  lat?: number,
  lng?: number,
): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed && !looksLikeCoordinates(trimmed) && !isGenericLabel(trimmed)) {
    return cleanFormattedAddress(trimmed) || trimmed;
  }
  if (typeof lat === "number" && typeof lng === "number") {
    return nearestAreaName(lat, lng);
  }
  return "Pinned location";
}
