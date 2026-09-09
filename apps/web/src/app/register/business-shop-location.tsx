"use client";

import { DeliveryMap } from "@/components/delivery-map";
import { MapsProvider, PlaceSearch, reverseGeocode, useMapsAvailable } from "@/components/maps-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "h-12 rounded-xl border-transparent bg-muted text-base shadow-none focus-visible:border-foreground";

export function BusinessShopLocation({
  shopAddress,
  shopPin,
  onAddressChange,
  onPinChange,
}: {
  shopAddress: string;
  shopPin: { lat: number; lng: number } | null;
  onAddressChange: (address: string) => void;
  onPinChange: (pin: { lat: number; lng: number }) => void;
}) {
  return (
    <MapsProvider>
      <BusinessShopLocationInner
        shopAddress={shopAddress}
        shopPin={shopPin}
        onAddressChange={onAddressChange}
        onPinChange={onPinChange}
      />
    </MapsProvider>
  );
}

function BusinessShopLocationInner({
  shopAddress,
  shopPin,
  onAddressChange,
  onPinChange,
}: {
  shopAddress: string;
  shopPin: { lat: number; lng: number } | null;
  onAddressChange: (address: string) => void;
  onPinChange: (pin: { lat: number; lng: number }) => void;
}) {
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{dict.auth.shopLocation}</Label>
      <p className="text-sm text-muted-foreground">{dict.auth.shopLocationHint}</p>
      {mapsAvailable ? (
        <PlaceSearch
          placeholder={dict.order.searchPlace}
          className="h-12 text-lg"
          onSelect={(place) => {
            onAddressChange(place.address);
            onPinChange({ lat: place.lat, lng: place.lng });
          }}
        />
      ) : null}
      <Input
        className={inputClass}
        value={shopAddress}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder={dict.admin.address}
        required
      />
      <DeliveryMap
        standalone={false}
        height="240px"
        markers={
          shopPin
            ? [
                {
                  id: "shop",
                  lat: shopPin.lat,
                  lng: shopPin.lng,
                  label: dict.auth.shopLocation,
                  place: shopAddress,
                  kind: "pickup" as const,
                },
              ]
            : []
        }
        onMapClick={async (lat, lng) => {
          onPinChange({ lat, lng });
          onAddressChange(await reverseGeocode(lat, lng));
        }}
        routeHint={dict.order.mapTip}
      />
    </div>
  );
}
