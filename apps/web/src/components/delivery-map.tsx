"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  APILoadingStatus,
  Map as GoogleMap,
  Marker,
  useApiIsLoaded,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import { DRIVER_TYPE_LABELS, type DriverType } from "@direct/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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

function useMapsAuthOk(): boolean {
  // False during SSR and the first client render (so hydration matches),
  // then true after mount unless the key already failed this session.
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!MAPS_KEY || mapsAuthFailed) return;
    setOk(true);
    const listener = () => setOk(false);
    authListeners.add(listener);
    return () => {
      authListeners.delete(listener);
    };
  }, []);
  return ok;
}

/* Single source of truth below a MapsProvider: either the whole subtree has a
   working APIProvider, or none of it renders Google widgets. */
const MapsCtx = createContext(false);

/** True when live Google Maps UI (search, click-to-pin) is usable here. */
export function useMapsAvailable(): boolean {
  return useContext(MapsCtx);
}

type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  role?: DriverType | string;
  kind: "driver" | "pickup" | "dropoff" | "warehouse" | "live";
};

type LatLng = { lat: number; lng: number };

type Props = {
  markers: MapMarker[];
  routeHint?: string;
  height?: string;
  /** Driving route drawn through these points (pickup → [hub] → dropoff). */
  route?: LatLng[];
  /** Called with map coordinates when the user taps the map. */
  onMapClick?: (lat: number, lng: number) => void;
  /** Set false when an ancestor already renders <MapsProvider>. */
  standalone?: boolean;
};

const DEFAULT_CENTER = { lat: 33.8938, lng: 35.5018 }; // Beirut

/* Monochrome map styling to match the white/black design system. */
const LIGHT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#575757" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ededed" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d9d9d9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#8c8c8c" }] },
];

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a3a3a3" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#262626" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f1f1f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#333333" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f0f0f" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#737373" }] },
];

/** Wrap a page once so PlaceSearch + maps share one Google Maps loader. */
export function MapsProvider({ children }: { children: React.ReactNode }) {
  const ok = useMapsAuthOk();
  if (!MAPS_KEY || !ok) return <MapsCtx.Provider value={false}>{children}</MapsCtx.Provider>;
  return (
    <APIProvider apiKey={MAPS_KEY} libraries={["places"]}>
      <MapsCtx.Provider value={true}>{children}</MapsCtx.Provider>
    </APIProvider>
  );
}

type PlaceSearchProps = {
  placeholder?: string;
  onSelect: (place: { address: string; lat: number; lng: number }) => void;
  className?: string;
};

/** Places Autocomplete input. Must render inside MapsProvider. */
export function PlaceSearch(props: PlaceSearchProps) {
  const available = useContext(MapsCtx);
  if (!available) return <Input placeholder={props.placeholder} className={props.className} />;
  return <PlaceSearchInner {...props} />;
}

function PlaceSearchInner({ placeholder, onSelect, className }: PlaceSearchProps) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["geometry.location", "formatted_address", "name"],
      componentRestrictions: { country: "lb" },
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      onSelectRef.current({
        address: place.formatted_address ?? place.name ?? "",
        lat: loc.lat(),
        lng: loc.lng(),
      });
    });
    return () => listener.remove();
  }, [places]);

  return <Input ref={inputRef} placeholder={placeholder} className={className} aria-label={placeholder} />;
}

/** Best-effort address for a tapped point. Falls back to coordinates. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (typeof google === "undefined" || !google.maps?.Geocoder) return fallback;
  try {
    const geocoder = new google.maps.Geocoder();
    const res = await geocoder.geocode({ location: { lat, lng } });
    return res.results[0]?.formatted_address ?? fallback;
  } catch {
    return fallback;
  }
}

function markerColors(kind: MapMarker["kind"], dark: boolean) {
  const foreground = dark ? "#f5f5f5" : "#0a0a0a";
  const brand = dark ? "#4d82f3" : "#2563eb";
  switch (kind) {
    case "live":
      return { fill: brand, scale: 9 };
    case "pickup":
      return { fill: foreground, scale: 8 };
    case "dropoff":
      return { fill: foreground, scale: 8 };
    case "warehouse":
      return { fill: dark ? "#a3a3a3" : "#404040", scale: 7 };
    default:
      return { fill: dark ? "#8c8c8c" : "#737373", scale: 7 };
  }
}

/** Recenter / refit whenever the marker set changes. */
function FitToMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const loaded = useApiIsLoaded();

  useEffect(() => {
    if (!map || !loaded) return;
    if (markers.length === 0) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(12);
      return;
    }
    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const m of markers) bounds.extend({ lat: m.lat, lng: m.lng });
    map.fitBounds(bounds, 56);
  }, [map, loaded, markers]);

  return null;
}

function MapMarkers({ markers, dark }: { markers: MapMarker[]; dark: boolean }) {
  const loaded = useApiIsLoaded();
  if (!loaded) return null;

  return (
    <>
      {markers.map((m) => {
        const { fill, scale } = markerColors(m.kind, dark);
        return (
          <Marker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.label}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale,
              fillColor: fill,
              fillOpacity: 1,
              strokeColor: dark ? "#0a0a0a" : "#ffffff",
              strokeWeight: 2.5,
            }}
            zIndex={m.kind === "live" ? 30 : m.kind === "pickup" || m.kind === "dropoff" ? 20 : 10}
          />
        );
      })}
    </>
  );
}

/** Driving route via the Directions service, drawn as a brand-blue polyline. */
function RoutePolyline({ points, dark }: { points: LatLng[]; dark: boolean }) {
  const map = useMap();
  const loaded = useApiIsLoaded();
  const [path, setPath] = useState<google.maps.LatLng[] | null>(null);
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (!loaded || points.length < 2) {
      setPath(null);
      return;
    }
    let cancelled = false;
    const service = new google.maps.DirectionsService();
    service
      .route({
        origin: points[0],
        destination: points[points.length - 1],
        waypoints: points.slice(1, -1).map((p) => ({ location: p, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
      })
      .then((res) => {
        if (!cancelled) setPath(res.routes[0]?.overview_path ?? null);
      })
      .catch(() => {
        if (!cancelled) setPath(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, key]);

  useEffect(() => {
    if (!map || !path) return;
    const line = new google.maps.Polyline({
      map,
      path,
      strokeColor: dark ? "#4d82f3" : "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    return () => line.setMap(null);
  }, [map, path, dark]);

  return null;
}

function LiveMapInner({
  markers,
  height,
  route,
  onMapClick,
}: {
  markers: MapMarker[];
  height: string;
  route?: LatLng[];
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const styles = useMemo(() => (dark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES), [dark]);

  function handleClick(e: MapMouseEvent) {
    const latLng = e.detail.latLng;
    if (latLng && onMapClick) onMapClick(latLng.lat, latLng.lng);
  }

  return (
    <div className="overflow-hidden rounded-xl border" style={{ height }}>
      <GoogleMap
        defaultCenter={markers[0] ?? DEFAULT_CENTER}
        defaultZoom={13}
        styles={styles}
        disableDefaultUI
        zoomControl
        gestureHandling="cooperative"
        reuseMaps
        style={{ width: "100%", height: "100%" }}
        onClick={onMapClick ? handleClick : undefined}
      >
        <MapMarkers markers={markers} dark={dark} />
        {route && route.length >= 2 ? <RoutePolyline points={route} dark={dark} /> : null}
        <FitToMarkers markers={markers} />
      </GoogleMap>
    </div>
  );
}

/** Map panel — interactive Google Map when a key is set, placeholder otherwise. */
export function DeliveryMap({ standalone = true, ...rest }: Props) {
  if (standalone) {
    return (
      <MapsProvider>
        <DeliveryMapCard {...rest} />
      </MapsProvider>
    );
  }
  return <DeliveryMapCard {...rest} />;
}

function DeliveryMapCard({
  markers,
  routeHint,
  height = "320px",
  route,
  onMapClick,
}: Omit<Props, "standalone">) {
  const { dict } = useI18n();
  const mapsAvailable = useContext(MapsCtx);

  const inner = mapsAvailable ? (
    <LiveMapInner markers={markers} height={height} route={route} onMapClick={onMapClick} />
  ) : (
    <div
      className="relative overflow-hidden rounded-xl border border-dashed bg-muted"
      style={{ height }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgb(37_99_235/0.10),transparent_50%),radial-gradient(circle_at_70%_60%,rgb(115_115_115/0.10),transparent_45%)]" />
      <div className="relative flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-lg font-semibold">{dict.client.liveMap}</p>
        <p className="max-w-sm text-base text-muted-foreground">
          {MAPS_KEY ? dict.client.mapsAuthFailed : dict.client.mapsMissingKey}
        </p>
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{dict.client.liveMap}</CardTitle>
        {routeHint ? <p className="text-base text-muted-foreground">{routeHint}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {inner}
        <ul className="flex flex-col gap-2">
          {markers.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-base"
            >
              <span className="font-medium">{m.label}</span>
              <div className="flex items-center gap-2">
                {m.role ? (
                  <Badge variant="secondary">
                    {DRIVER_TYPE_LABELS[m.role as DriverType] ?? m.role}
                  </Badge>
                ) : null}
                <Badge variant="outline">{m.kind}</Badge>
                <span className="font-mono text-sm text-muted-foreground">
                  {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                </span>
              </div>
            </li>
          ))}
          {markers.length === 0 ? (
            <li className="text-base text-muted-foreground">—</li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
