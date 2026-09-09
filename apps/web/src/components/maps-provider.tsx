"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { getMapsKey, useMapsAuthOk } from "@/components/maps-config";
import {
  locationLabel,
  nameFromGeocoderResult,
  nameFromPlace,
  nearestAreaName,
} from "@/lib/place-name";

export { hasMapsKey, mapsConfigured } from "@/components/maps-config";

/* Single source of truth below a MapsProvider: either the whole subtree has a
   working APIProvider, or none of it renders Google widgets. */
const MapsCtx = createContext(false);

/** True when live Google Maps UI (search, click-to-pin) is usable here. */
export function useMapsAvailable(): boolean {
  return useContext(MapsCtx);
}

/** Wrap a page once so PlaceSearch + maps share one Google Maps loader. */
export function MapsProvider({ children }: { children: React.ReactNode }) {
  const ok = useMapsAuthOk();
  const mapsKey = getMapsKey();
  if (!mapsKey || !ok) return <MapsCtx.Provider value={false}>{children}</MapsCtx.Provider>;
  return (
    <APIProvider apiKey={mapsKey} libraries={["places"]}>
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

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["geometry.location", "formatted_address", "name", "address_components"],
      componentRestrictions: { country: "lb" },
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      const lat = loc.lat();
      const lng = loc.lng();
      onSelectRef.current({
        address: locationLabel(nameFromPlace(place), lat, lng),
        lat,
        lng,
      });
    });
    return () => listener.remove();
  }, [places]);

  return <Input ref={inputRef} placeholder={placeholder} className={className} aria-label={placeholder} />;
}

/** Best-effort place name for a tapped point. Never returns raw coordinates. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = nearestAreaName(lat, lng);
  if (typeof google === "undefined" || !google.maps?.Geocoder) return fallback;
  try {
    const geocoder = new google.maps.Geocoder();
    const res = await geocoder.geocode({ location: { lat, lng } });
    for (const result of res.results) {
      const name = nameFromGeocoderResult(result);
      if (name) return name;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
