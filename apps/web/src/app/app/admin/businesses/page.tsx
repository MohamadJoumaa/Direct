"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  DeliveryMap,
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
} from "@/components/delivery-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

const DEFAULT_PIN = { lat: 33.8938, lng: 35.5018 };

export default function AdminBusinessesPage() {
  return (
    <MapsProvider>
      <BusinessesContent />
    </MapsProvider>
  );
}

function BusinessesContent() {
  const { isAdmin } = useAuth();
  const { state, updateProfile } = useStore();
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();

  const businesses = state.profiles.filter((p) => p.role === "business");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    businesses.find((b) => b.id === selectedId) ?? businesses[0] ?? null;

  const [address, setAddress] = useState("");
  const [pin, setPin] = useState(DEFAULT_PIN);

  useEffect(() => {
    if (!selected) return;
    setAddress(selected.business_address ?? "");
    setPin({
      lat: selected.business_lat ?? DEFAULT_PIN.lat,
      lng: selected.business_lng ?? DEFAULT_PIN.lng,
    });
  }, [selected]);

  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const err = updateProfile(selected.id, {
      business_address: address.trim() || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`,
      business_lat: pin.lat,
      business_lng: pin.lng,
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.admin.locationSaved);
  }

  return (
    <AppShell title={dict.nav.businesses}>
      <div className="flex flex-col gap-6">
        <h1 className="heading-easy">{dict.admin.businessesTitle}</h1>

        {businesses.length === 0 ? (
          <Card className="border-2">
            <CardContent className="py-10 text-center text-easy text-muted-foreground">
              {dict.admin.noBusinesses}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {businesses.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className={`touch-target rounded-xl border-2 p-4 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    selected?.id === b.id
                      ? "border-foreground bg-muted"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  <p className="text-lg font-semibold">{b.business_name || b.full_name}</p>
                  <p className="text-base text-muted-foreground">
                    {b.business_address?.trim() || dict.auth.pinRequired}
                  </p>
                </button>
              ))}
            </div>

            {selected ? (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">
                    <Store className="me-2 inline size-6" />
                    {dict.admin.shopLocation}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <form onSubmit={onSave} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="biz-address">{dict.admin.address}</Label>
                      {mapsAvailable ? (
                        <PlaceSearch
                          placeholder={dict.order.searchPlace}
                          className="h-11"
                          onSelect={(place) => {
                            setAddress(place.address);
                            setPin({ lat: place.lat, lng: place.lng });
                          }}
                        />
                      ) : null}
                      <Input
                        id="biz-address"
                        className="h-11"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={dict.admin.address}
                        required={!mapsAvailable}
                      />
                    </div>
                    <Button type="submit" size="lg" className="touch-target w-fit rounded-full px-6">
                      {dict.admin.setLocation}
                    </Button>
                  </form>
                  <DeliveryMap
                    standalone={false}
                    height="260px"
                    markers={[
                      {
                        id: selected.id,
                        lat: pin.lat,
                        lng: pin.lng,
                        label: selected.business_name || selected.full_name,
                        kind: "pickup",
                      },
                    ]}
                    onMapClick={async (lat, lng) => {
                      setPin({ lat, lng });
                      setAddress(await reverseGeocode(lat, lng));
                    }}
                    routeHint={dict.admin.shopPinHint}
                  />
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
