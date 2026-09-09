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
            title={`${m.label} — ${locationLabel(m.place, m.lat, m.lng)}`}
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
