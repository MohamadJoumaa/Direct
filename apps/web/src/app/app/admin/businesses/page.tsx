"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store, CircleDollarSign } from "lucide-react";
import { formatDeliveryCash, withBusinessOrderCosts } from "@direct/shared";
import {
  DeliveryMap,
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
} from "@/components/delivery-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";

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
  const { state, updateProfile, updateBusinessOrderCosts } = useStore();
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();

  const businesses = state.profiles.filter((p) => p.role === "business");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = businesses.find((b) => b.id === selectedId) ?? null;

  const [address, setAddress] = useState("");
  const [pin, setPin] = useState(DEFAULT_PIN);

  const [minUsd, setMinUsd] = useState("");
  const [maxUsd, setMaxUsd] = useState("");
  const [minLbp, setMinLbp] = useState("");
  const [maxLbp, setMaxLbp] = useState("");

  useEffect(() => {
    if (!selected) return;
    setAddress(
      selected.business_address?.trim()
        ? locationLabel(selected.business_address, selected.business_lat, selected.business_lng)
        : "",
    );
    setPin({
      lat: selected.business_lat ?? DEFAULT_PIN.lat,
      lng: selected.business_lng ?? DEFAULT_PIN.lng,
    });
    const costs = withBusinessOrderCosts(selected);
    setMinUsd(String(costs.order_min_usd));
    setMaxUsd(String(costs.order_max_usd));
    setMinLbp(String(costs.order_min_lbp));
    setMaxLbp(String(costs.order_max_lbp));
  }, [selected]);

  if (!isAdmin) {
    return (
        <p className="text-easy">{dict.common.adminOnly}</p>
    );
  }

  async function onSaveLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const resolvedAddress = address.trim() || await reverseGeocode(pin.lat, pin.lng);
    const err = updateProfile(selected.id, {
      business_address: resolvedAddress,
      business_lat: pin.lat,
      business_lng: pin.lng,
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.admin.locationSaved);
  }

  function onSaveCosts(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const err = updateBusinessOrderCosts(selected.id, {
      order_min_usd: Number(minUsd),
      order_max_usd: Number(maxUsd),
      order_min_lbp: Number(minLbp),
      order_max_lbp: Number(maxLbp),
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.admin.costsSaved);
  }

  return (
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
              {businesses.map((b) => {
                const costs = withBusinessOrderCosts(b);
                const open = selectedId === b.id;
                return (
                  <div
                    key={b.id}
                    className={`rounded-xl border-2 transition-colors ${
                      open
                        ? "border-foreground bg-muted"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setSelectedId((id) => (id === b.id ? null : b.id))}
                      className="touch-target w-full p-4 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <p className="text-lg font-semibold">{b.business_name || b.full_name}</p>
                      <p className="text-base text-muted-foreground">
                        {b.business_address?.trim()
                          ? locationLabel(b.business_address, b.business_lat, b.business_lng)
                          : dict.auth.pinRequired}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDeliveryCash(costs.order_min_usd, costs.order_min_lbp)} –{" "}
                        {formatDeliveryCash(costs.order_max_usd, costs.order_max_lbp)}
                      </p>
                    </button>
                    {open && selected ? (
                      <div className="flex flex-col gap-4 border-t p-4">
                        <div>
                          <h2 className="text-2xl font-semibold">
                            <Store className="me-2 inline size-6" />
                            {dict.admin.shopLocation}
                          </h2>
                        </div>
                        <form onSubmit={onSaveLocation} className="flex flex-col gap-4">
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
                          showLegend={false}
                          height="260px"
                          markers={[
                            {
                              id: selected.id,
                              lat: pin.lat,
                              lng: pin.lng,
                              label: selected.business_name || selected.full_name,
                              place: address,
                              kind: "pickup",
                            },
                          ]}
                          onMapClick={async (lat, lng) => {
                            setPin({ lat, lng });
                            setAddress(await reverseGeocode(lat, lng));
                          }}
                          routeHint={dict.admin.shopPinHint}
                        />
                        <div className="border-t pt-4">
                          <div className="mb-3 flex items-center gap-2">
                            <CircleDollarSign className="size-5 text-muted-foreground" />
                            <h3 className="text-xl font-semibold">{dict.admin.orderCostsTitle}</h3>
                          </div>
                          <p className="mb-4 text-base text-muted-foreground">{dict.admin.orderCostsBody}</p>
                          <form onSubmit={onSaveCosts} className="grid gap-4 sm:grid-cols-2">
                            <CostField id="min-usd" label={dict.admin.minUsd} value={minUsd} onChange={setMinUsd} />
                            <CostField id="max-usd" label={dict.admin.maxUsd} value={maxUsd} onChange={setMaxUsd} />
                            <CostField id="min-lbp" label={dict.admin.minLbp} value={minLbp} onChange={setMinLbp} step="1000" />
                            <CostField id="max-lbp" label={dict.admin.maxLbp} value={maxLbp} onChange={setMaxLbp} step="1000" />
                            <Button type="submit" size="lg" className="touch-target w-fit rounded-full px-6 sm:col-span-2">
                              {dict.admin.saveCosts}
                            </Button>
                          </form>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
  );
}

function CostField({
  id,
  label,
  value,
  onChange,
  step = "0.01",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-lg">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={0}
        inputMode="decimal"
        className="h-12 text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
