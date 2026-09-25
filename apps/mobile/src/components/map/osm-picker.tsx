import React, { useCallback, useMemo, useRef } from "react";
import { View, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { LatLng } from "@direct/shared";

import { useTheme } from "@/theme/theme-context";

/**
 * A map that needs no API key.
 *
 * Google Maps on Android requires a key delivered through native config, and
 * native config never reaches Expo Go — which is why `PROVIDER_GOOGLE` draws a
 * black rectangle there and why picking a location was impossible without a
 * development build. Leaflet over OpenStreetMap tiles has no such requirement:
 * it is HTML, it runs in a WebView, it costs nothing, and it works identically
 * in Expo Go, a dev build, and the store build.
 *
 * It is deliberately only the **picker's** fallback, not a replacement for
 * `react-native-maps` everywhere. Live driver tracking wants a native surface
 * with smooth marker animation; choosing a point wants tiles and a pin, which
 * is exactly what this does well.
 *
 * The page is a string rather than a bundled asset so there is nothing to
 * resolve at runtime and no extra file to keep in step. Tiles come from
 * OpenStreetMap, whose usage policy asks for a real User-Agent and light
 * traffic — a person dragging a pin a few times is well within it.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = "&copy; OpenStreetMap";

/**
 * Leaflet is loaded from its CDN rather than bundled.
 *
 * Pinned to an exact version: an unpinned CDN link is someone else's ability
 * to change what runs inside our app. A phone with no connection shows an
 * empty map here, which is the same thing it would show with no tiles anyway.
 */
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

/**
 * The origin the page is loaded under.
 *
 * An HTML string with no base URL loads as `about:blank`, and a page with no
 * origin sends no `Referer` with its tile requests. OpenStreetMap's tile
 * servers refuse exactly those: every tile comes back as an "Access blocked,
 * Referer is required" image, so the picker would show a grid of warnings
 * instead of Lebanon. An https origin that names us fixes it, and is what the
 * tile usage policy asks for. The deployed website's origin when one is
 * configured over https; the app id otherwise (dev points at localhost).
 */
const PAGE_ORIGIN = (() => {
  const configured = process.env.EXPO_PUBLIC_WEB_URL ?? "";
  return /^https:\/\//.test(configured)
    ? configured.replace(/\/*$/, "/")
    : "https://com.directdelivery.app/";
})();

function page(centre: LatLng, zoom: number): string {
  // JSON.stringify on the numbers, so nothing the caller passes can end up
  // being read as code in the page.
  const lat = JSON.stringify(centre.lat);
  const lng = JSON.stringify(centre.lng);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${LEAFLET_CSS}" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e9e5de; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${LEAFLET_JS}"></script>
  <script>
    (function () {
      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }
      try {
        var map = L.map('map', { zoomControl: false, attributionControl: true })
          .setView([${lat}, ${lng}], ${JSON.stringify(zoom)});
        L.tileLayer(${JSON.stringify(TILE_URL)}, {
          maxZoom: 19,
          attribution: ${JSON.stringify(ATTRIBUTION)}
        }).addTo(map);

        // The pin is drawn by React on top of the WebView, fixed at the centre,
        // so all this has to report is where the centre landed.
        map.on('moveend', function () {
          var c = map.getCenter();
          post({ type: 'centre', lat: c.lat, lng: c.lng });
        });

        // Let the native side recentre without reloading the page.
        window.__setCentre = function (la, ln, zm) {
          map.setView([la, ln], zm == null ? map.getZoom() : zm, { animate: true });
        };

        post({ type: 'ready' });
      } catch (err) {
        post({ type: 'error', message: String(err && err.message ? err.message : err) });
      }
    })();
  </script>
</body>
</html>`;
}

export type OpenStreetMapPickerHandle = {
  /** Recentre without reloading — a reload would lose the user's zoom. */
  setCentre: (point: LatLng, zoom?: number) => void;
};

export function OpenStreetMapPicker({
  initial,
  zoom = 15,
  onCentreChange,
  onReady,
  handleRef,
  style,
}: {
  initial: LatLng;
  zoom?: number;
  onCentreChange: (point: LatLng) => void;
  onReady?: () => void;
  handleRef?: React.MutableRefObject<OpenStreetMapPickerHandle | null>;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const webRef = useRef<WebView | null>(null);

  // Built once. Re-rendering the HTML would reload the page and throw away
  // wherever the user had panned to.
  const html = useMemo(() => page(initial, zoom), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (handleRef) {
    handleRef.current = {
      setCentre: (point, nextZoom) => {
        webRef.current?.injectJavaScript(
          `window.__setCentre && window.__setCentre(${JSON.stringify(point.lat)}, ${JSON.stringify(
            point.lng,
          )}, ${nextZoom == null ? "null" : JSON.stringify(nextZoom)}); true;`,
        );
      },
    };
  }

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          lat?: number;
          lng?: number;
        };
        if (data.type === "centre" && typeof data.lat === "number" && typeof data.lng === "number") {
          onCentreChange({ lat: data.lat, lng: data.lng });
        }
        if (data.type === "ready") onReady?.();
      } catch {
        // A malformed message is not worth interrupting a booking for.
      }
    },
    [onCentreChange, onReady],
  );

  return (
    <View style={[{ flex: 1, backgroundColor: colors.muted }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: PAGE_ORIGIN }}
        // Appended to the WebView's User-Agent so tile requests say which app
        // they come from, as the OpenStreetMap tile policy requires.
        applicationNameForUserAgent="DirectDelivery"
        onMessage={onMessage}
        // The page is ours and static; nothing in it should navigate away.
        javaScriptEnabled
        domStorageEnabled={false}
        // Android draws WebViews on a texture by default, which is what makes
        // a map inside one stutter while dragging.
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
