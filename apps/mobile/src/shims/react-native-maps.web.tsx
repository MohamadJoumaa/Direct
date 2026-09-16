import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { View, type ViewProps, type ViewStyle } from "react-native";

export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = undefined;

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};

/* Monochrome map styling matching the Direct design system. */
const LIGHT_MAP_STYLES = [
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

const DARK_MAP_STYLES = [
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

function latitudeDeltaToZoom(latitudeDelta: number): number {
  if (!latitudeDelta || latitudeDelta <= 0) return 14;
  const zoom = Math.round(Math.log2(360 / latitudeDelta));
  return Math.min(Math.max(zoom, 1), 20);
}

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if ((window as any).google?.maps) return Promise.resolve();

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      if ((window as any).google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

type MapContextType = {
  map: any | null;
  mapsApi: any | null;
};

const MapContext = createContext<MapContextType>({ map: null, mapsApi: null });

export type MapViewProps = ViewProps & {
  initialRegion?: Region;
  region?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  userInterfaceStyle?: "light" | "dark";
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  toolbarEnabled?: boolean;
  showsCompass?: boolean;
  provider?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export type MapViewRef = {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    coordinates: LatLng[],
    options?: { edgePadding?: { top?: number; right?: number; bottom?: number; left?: number } }
  ) => void;
};

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(
  {
    initialRegion,
    region,
    onRegionChangeComplete,
    userInterfaceStyle = "light",
    scrollEnabled = true,
    zoomEnabled = true,
    style,
    children,
    ...rest
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapsState, setMapsState] = useState<MapContextType>({ map: null, mapsApi: null });
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // Expose imperative API matching react-native-maps.
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (nextRegion: Region) => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.panTo({
          lat: nextRegion.latitude,
          lng: nextRegion.longitude,
        });
        if (nextRegion.latitudeDelta) {
          mapInstanceRef.current.setZoom(latitudeDeltaToZoom(nextRegion.latitudeDelta));
        }
      },
      fitToCoordinates: (coordinates: LatLng[]) => {
        if (!mapInstanceRef.current || !mapsState.mapsApi || !coordinates.length) return;
        const bounds = new mapsState.mapsApi.LatLngBounds();
        coordinates.forEach((c) => bounds.extend({ lat: c.latitude, lng: c.longitude }));
        mapInstanceRef.current.fitBounds(bounds);
      },
    }),
    [mapsState.mapsApi]
  );

  useEffect(() => {
    let active = true;

    if (!apiKey) return;

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!active || !containerRef.current) return;
        const google = (window as any).google;
        if (!google?.maps) return;

        const startRegion = region ?? initialRegion ?? {
          latitude: 33.8938,
          longitude: 35.5018,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: startRegion.latitude, lng: startRegion.longitude },
          zoom: latitudeDeltaToZoom(startRegion.latitudeDelta),
          styles: userInterfaceStyle === "dark" ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: zoomEnabled !== false,
          gestureHandling: scrollEnabled === false ? "none" : "auto",
          keyboardShortcuts: false,
        });

        mapInstanceRef.current = map;
        setMapsState({ map, mapsApi: google.maps });

        if (onRegionChangeComplete) {
          map.addListener("idle", () => {
            const center = map.getCenter();
            if (!center) return;
            const bounds = map.getBounds();
            let latitudeDelta = 0.02;
            let longitudeDelta = 0.02;
            if (bounds) {
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              latitudeDelta = Math.abs(ne.lat() - sw.lat());
              longitudeDelta = Math.abs(ne.lng() - sw.lng());
            }
            onRegionChangeComplete({
              latitude: center.lat(),
              longitude: center.lng(),
              latitudeDelta,
              longitudeDelta,
            });
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to load Google Maps script on web:", err);
      });

    return () => {
      active = false;
      mapInstanceRef.current = null;
    };
  }, [apiKey]);

  // Update theme dynamically when userInterfaceStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({
      styles: userInterfaceStyle === "dark" ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
    });
  }, [userInterfaceStyle]);

  return (
    <View style={[{ flex: 1, position: "relative", minHeight: 200, overflow: "hidden" }, style]} {...rest}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      <MapContext.Provider value={mapsState}>{children}</MapContext.Provider>
    </View>
  );
});

export type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  anchor?: { x: number; y: number };
  children?: React.ReactNode;
  tracksViewChanges?: boolean;
};

export function Marker({ coordinate, title, anchor = { x: 0.5, y: 0.5 }, children }: MarkerProps) {
  const { map, mapsApi } = useContext(MapContext);
  const [container] = useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.transform = `translate(-${anchor.x * 100}%, -${anchor.y * 100}%)`;
    el.style.cursor = "pointer";
    return el;
  });

  useEffect(() => {
    if (!map || !mapsApi || !container) return;
    const targetEl = container;

    // Custom overlay to position arbitrary React/React Native nodes on the Google map
    class CustomMarkerOverlay extends mapsApi.OverlayView {
      onAdd() {
        const panes = this.getPanes();
        panes?.overlayMouseTarget?.appendChild(targetEl);
      }
      draw() {
        const projection = this.getProjection();
        if (!projection) return;
        const pos = projection.fromLatLngToDivPixel(
          new mapsApi.LatLng(coordinate.latitude, coordinate.longitude)
        );
        if (pos) {
          targetEl.style.left = `${pos.x}px`;
          targetEl.style.top = `${pos.y}px`;
        }
      }
      onRemove() {
        if (targetEl.parentElement) {
          targetEl.parentElement.removeChild(targetEl);
        }
      }
    }

    const overlay = new CustomMarkerOverlay();
    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
    };
  }, [map, mapsApi, coordinate.latitude, coordinate.longitude, container]);

  if (!children || !container) return null;

  return createPortal(children, container);
}

export type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
};

export function Polyline({ coordinates, strokeColor = "#2563eb", strokeWidth = 4 }: PolylineProps) {
  const { map, mapsApi } = useContext(MapContext);

  useEffect(() => {
    if (!map || !mapsApi || !coordinates.length) return;

    const polyline = new mapsApi.Polyline({
      path: coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude })),
      strokeColor,
      strokeWeight: strokeWidth,
      strokeOpacity: 0.9,
      map,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, mapsApi, coordinates, strokeColor, strokeWidth]);

  return null;
}

export const Circle = () => null;
export const Callout = (props: ViewProps) => <View {...props} />;

export default MapView;
