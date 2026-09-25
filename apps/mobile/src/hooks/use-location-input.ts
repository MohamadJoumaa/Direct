import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@direct/shared";

import type { PickedLocation } from "@/components/map/location-picker";
import { geocodeText } from "@/lib/reverse-geocode";

/**
 * One location, however the person chose to give it.
 *
 * A pin and a typed landmark are the same answer arriving by different routes,
 * so they share one piece of state rather than two that can disagree. Dropping
 * a pin fills the text; typing looks up a point. Whichever happened last wins,
 * and `point` is always the coordinates that will be saved.
 *
 * The note is never geocoded. It is the sentence that gets a driver from the
 * landmark to the actual door — "third floor, blue gate" — and it is written
 * for a person to read, so it travels with the address rather than through it.
 */
export type LocationInput = {
  text: string;
  note: string;
  /** Null until a pin is dropped or the typed text resolves. */
  point: LatLng | null;
  resolving: boolean;
  setText: (next: string) => void;
  setNote: (next: string) => void;
  applyPin: (picked: PickedLocation) => void;
  reset: () => void;
  /** What gets stored as the address: the landmark, plus the note if given. */
  label: string;
};

/** How long to wait after a keystroke before spending a geocoder call. */
const GEOCODE_DEBOUNCE_MS = 900;

export function useLocationInput(initial?: {
  text?: string | null;
  point?: LatLng | null;
}): LocationInput {
  const [text, setTextState] = useState(initial?.text ?? "");
  const [note, setNote] = useState("");
  const [point, setPoint] = useState<LatLng | null>(initial?.point ?? null);
  const [resolving, setResolving] = useState(false);

  /**
   * Set when a pin is dropped, cleared when the person types again.
   *
   * Without it the debounce below would fire on the text the pin just wrote,
   * geocode that label, and quietly move the point somewhere else — undoing
   * the precise thing the person had just done by hand.
   */
  const fromPin = useRef(false);

  const setText = useCallback((next: string) => {
    fromPin.current = false;
    setTextState(next);
  }, []);

  const applyPin = useCallback((picked: PickedLocation) => {
    fromPin.current = true;
    setTextState(picked.label);
    setPoint({ lat: picked.lat, lng: picked.lng });
    setResolving(false);
  }, []);

  const reset = useCallback(() => {
    fromPin.current = false;
    setTextState("");
    setNote("");
    setPoint(null);
    setResolving(false);
  }, []);

  useEffect(() => {
    if (fromPin.current) return;
    const query = text.trim();
    if (query.length < 3) {
      setPoint(null);
      setResolving(false);
      return;
    }

    let current = true;
    setResolving(true);
    const timer = setTimeout(() => {
      void geocodeText(query).then((found) => {
        if (!current) return;
        // Null is kept as null on purpose. A landmark the geocoder does not
        // know leaves the order without coordinates, and the screen refuses to
        // submit — better than pricing a delivery against a guess.
        setPoint(found);
        setResolving(false);
      });
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text]);

  const trimmedNote = note.trim();
  const label = trimmedNote ? `${text.trim()} — ${trimmedNote}` : text.trim();

  return { text, note, point, resolving, setText, setNote, applyPin, reset, label };
}
