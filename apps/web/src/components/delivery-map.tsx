"use client";

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { hasMapsKey } from "@/components/maps-config";
import { MapsProvider, useMapsAvailable } from "@/components/maps-provider";
import { useI18n } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/en";
import { locationLabel } from "@/lib/place-name";

export {
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
  mapsConfigured,
} from "@/components/maps-provider";

const LiveMapInner = dynamic(
  () => import("@/components/delivery-map-canvas").then((mod) => mod.LiveMapInner),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[160px] animate-pulse rounded-xl border bg-muted" />,
  },
);

type LatLng = { lat: number; lng: number };

type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  place?: string;
  role?: string;
  kind: "driver" | "pickup" | "dropoff" | "warehouse" | "live";
};

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
  /** Marker summary list under the map. Default true. */
  showLegend?: boolean;
};

function markerKindLabel(kind: MapMarker["kind"], dict: Dictionary): string {
  switch (kind) {
    case "pickup":
      return dict.common.pickup;
    case "dropoff":
      return dict.common.dropoff;
    case "warehouse":
      return dict.common.warehouse;
    case "live":
      return dict.client.liveMap;
    default:
      return dict.common.driver;
  }
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
  showLegend = true,
}: Omit<Props, "standalone">) {
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();

  const inner = mapsAvailable ? (
    <div style={{ height }}>
      <LiveMapInner markers={markers} height="100%" route={route} onMapClick={onMapClick} />
    </div>
  ) : (
    <Empty className="relative overflow-hidden rounded-xl border border-dashed bg-muted" style={{ height }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgb(37_99_235/0.10),transparent_50%),radial-gradient(circle_at_70%_60%,rgb(115_115_115/0.10),transparent_45%)]" />
      <EmptyHeader className="relative">
        <EmptyTitle className="text-lg">{dict.client.liveMap}</EmptyTitle>
        <EmptyDescription className="max-w-sm text-base">
          {hasMapsKey() ? dict.client.mapsAuthFailed : dict.client.mapsMissingKey}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <Card className="overflow-hidden border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{dict.client.liveMap}</CardTitle>
        {routeHint ? <p className="text-base text-muted-foreground">{routeHint}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {inner}
        {showLegend ? (
          <ul className="flex flex-col gap-2">
            {markers.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-base"
              >
                <span className="font-medium">{m.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{markerKindLabel(m.kind, dict)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {locationLabel(m.place, m.lat, m.lng)}
                  </span>
                </div>
              </li>
            ))}
            {markers.length === 0 ? (
              <li className="text-base text-muted-foreground">—</li>
            ) : null}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
