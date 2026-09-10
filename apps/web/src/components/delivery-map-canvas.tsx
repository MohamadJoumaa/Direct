"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Map as GoogleMap,
  Marker,
  useApiIsLoaded,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import { locationLabel } from "@/lib/place-name";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Human place name (neighborhood / city). Shown instead of coordinates. */
  place?: string;
  role?: string;
  kind: "driver" | "pickup" | "dropoff" | "warehouse" | "live";
};

type LatLng = { lat: number; lng: number };

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
      return { fill: brand, scale: 7 };
  }
}

function isDriverMarker(kind: MapMarker["kind"]) {
  return kind === "driver" || kind === "live";
}

/** Filled motorcycle glyph (Material two-wheeler), 24×24. */
const MOTORCYCLE_GLYPH =
  "M19.44 9.03 15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.17 6.3 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.3 0 2.41.84 2.82 2H5v2h2.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z";

function motorcycleMarkerIcon(fill: string, dark: boolean): google.maps.Icon {
  const halo = dark ? "#0a0a0a" : "#ffffff";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="${fill}" stroke="${halo}" stroke-width="3.5"/><path fill="#ffffff" transform="translate(10.2 11.4) scale(1.15)" d="${MOTORCYCLE_GLYPH}"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22),
  };
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
        const motorcycle = isDriverMarker(m.kind);
        return (
          <Marker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            title={`${m.label} — ${locationLabel(m.place, m.lat, m.lng)}`}
            icon={
              motorcycle
                ? motorcycleMarkerIcon(fill, dark)
                : {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale,
                    fillColor: fill,
                    fillOpacity: 1,
                    strokeColor: dark ? "#0a0a0a" : "#ffffff",
                    strokeWeight: 2.5,
                  }
            }
            zIndex={
              m.kind === "live" ? 30 : m.kind === "driver" ? 25 : m.kind === "pickup" || m.kind === "dropoff" ? 20 : 10
            }
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale route when points drop
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

export function LiveMapInner({
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
