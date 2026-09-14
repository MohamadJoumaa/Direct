import { haversineKm } from "@direct/shared";

const COORD_RE = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}\b/i;

export type PlaceLang = "en" | "ar";

const NAMED_AREAS: { name: string; ar: string; lat: number; lng: number }[] = [
  { name: "Hamra, Beirut", ar: "الحمرا، بيروت", lat: 33.8959, lng: 35.478 },
  { name: "Ras Beirut", ar: "رأس بيروت", lat: 33.899, lng: 35.472 },
  { name: "Manara, Beirut", ar: "المنارة، بيروت", lat: 33.901, lng: 35.47 },
  { name: "Verdun, Beirut", ar: "فردان، بيروت", lat: 33.875, lng: 35.485 },
  { name: "Mazraa, Beirut", ar: "المزرعة، بيروت", lat: 33.878, lng: 35.503 },
  { name: "Tariq El Jdideh, Beirut", ar: "طريق الجديدة، بيروت", lat: 33.86, lng: 35.503 },
  { name: "Achrafieh, Beirut", ar: "الأشرفية، بيروت", lat: 33.8869, lng: 35.5194 },
  { name: "Gemmayzeh, Beirut", ar: "الجميزة، بيروت", lat: 33.895, lng: 35.512 },
  { name: "Mar Mikhael, Beirut", ar: "مار مخايل، بيروت", lat: 33.899, lng: 35.527 },
  { name: "Downtown Beirut", ar: "وسط بيروت", lat: 33.8938, lng: 35.5018 },
  { name: "Bourj Hammoud", ar: "برج حمود", lat: 33.894, lng: 35.54 },
  { name: "Sin El Fil", ar: "سن الفيل", lat: 33.87, lng: 35.54 },
  { name: "Jdeideh", ar: "الجديدة", lat: 33.89, lng: 35.56 },
  { name: "Beirut Airport area", ar: "محيط مطار بيروت", lat: 33.8208, lng: 35.4883 },
  { name: "Choueifat", ar: "الشويفات", lat: 33.81, lng: 35.52 },
  { name: "Jounieh", ar: "جونيه", lat: 33.98, lng: 35.62 },
  { name: "Dbayeh", ar: "ضبية", lat: 33.94, lng: 35.59 },
  { name: "Aley", ar: "عاليه", lat: 33.81, lng: 35.6 },
  { name: "Sidon", ar: "صيدا", lat: 33.56, lng: 35.37 },
  { name: "Tyre", ar: "صور", lat: 33.27, lng: 35.2 },
  { name: "Tripoli", ar: "طرابلس", lat: 34.43, lng: 35.83 },
  { name: "Zahle", ar: "زحلة", lat: 33.85, lng: 35.9 },
  { name: "Baalbek", ar: "بعلبك", lat: 34.0, lng: 36.21 },
];

const PINNED_LOCATION = "Pinned location";
const PINNED_LOCATION_AR = "موقع محدَّد على الخريطة";

/**
 * Place words we translate ourselves. Google returns Arabic names directly
 * once the maps loader runs in Arabic; this table is for the labels Direct
 * stored earlier in English, and for the offline fallback names.
 */
const PLACE_WORDS_AR: Record<string, string> = {
  lebanon: "لبنان",
  beirut: "بيروت",
  hamra: "الحمرا",
  manara: "المنارة",
  verdun: "فردان",
  mazraa: "المزرعة",
  achrafieh: "الأشرفية",
  gemmayzeh: "الجميزة",
  "mar mikhael": "مار مخايل",
  "ras beirut": "رأس بيروت",
  "downtown beirut": "وسط بيروت",
  "tariq el jdideh": "طريق الجديدة",
  "bourj hammoud": "برج حمود",
  "sin el fil": "سن الفيل",
  jdeideh: "الجديدة",
  choueifat: "الشويفات",
  jounieh: "جونيه",
  dbayeh: "ضبية",
  aley: "عاليه",
  sidon: "صيدا",
  saida: "صيدا",
  tyre: "صور",
  tripoli: "طرابلس",
  zahle: "زحلة",
  baalbek: "بعلبك",
  byblos: "جبيل",
  jbeil: "جبيل",
  batroun: "البترون",
  chekka: "شكا",
  nabatieh: "النبطية",
  "mount lebanon": "جبل لبنان",
  "south lebanon": "جنوب لبنان",
  "north lebanon": "شمال لبنان",
  bekaa: "البقاع",
  "beirut airport area": "محيط مطار بيروت",
  "rafic hariri international airport": "مطار رفيق الحريري الدولي",
};

/**
 * Arabic rendering of a place label. Unknown names stay as they are — a half
 * translated address is worse than the original, so we only swap parts we
 * actually know.
 */
export function localizePlaceName(value: string, lang: PlaceLang): string {
  const trimmed = value?.trim() ?? "";
  if (lang !== "ar" || !trimmed) return trimmed;
  if (trimmed === PINNED_LOCATION) return PINNED_LOCATION_AR;
  const known = NAMED_AREAS.find((a) => a.name === trimmed);
  if (known) return known.ar;
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  const translated = parts.map((p) => PLACE_WORDS_AR[p.toLowerCase()] ?? p);
  if (translated.every((p, i) => p === parts[i])) return trimmed;
  // Arabic lists read with the Arabic comma.
  return translated.join("، ");
}

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
  return bestKm <= 18 ? best.name : PINNED_LOCATION;
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

/**
 * Human location name for UI. Never returns raw coordinates. Pass `lang` on
 * display surfaces so a reader in Arabic sees the place named in Arabic; the
 * store keeps the label it was given, so omitting `lang` is the right thing
 * when normalising a value for storage.
 */
export function locationLabel(
  value: string | undefined | null,
  lat?: number,
  lng?: number,
  lang: PlaceLang = "en",
): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed && !looksLikeCoordinates(trimmed) && !isGenericLabel(trimmed)) {
    return localizePlaceName(cleanFormattedAddress(trimmed) || trimmed, lang);
  }
  if (typeof lat === "number" && typeof lng === "number") {
    return localizePlaceName(nearestAreaName(lat, lng), lang);
  }
  return localizePlaceName(PINNED_LOCATION, lang);
}
