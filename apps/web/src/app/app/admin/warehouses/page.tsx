"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  DeliveryMap,
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
} from "@/components/delivery-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { formatOrderNumber } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";

const DEFAULT_PIN = { lat: 33.8938, lng: 35.5018 };

export default function AdminWarehousesPage() {
  return (
    <MapsProvider>
      <WarehousesContent />
    </MapsProvider>
  );
}

function WarehousesContent() {
  const { isAdmin } = useAuth();
  const {
    state,
    addWarehouse,
    removeWarehouse,
    addWarehouseProduct,
    removeWarehouseProduct,
  } = useStore();
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState(DEFAULT_PIN);
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productTarget, setProductTarget] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  async function onAddWarehouse(e: React.FormEvent) {
    e.preventDefault();
    const resolvedAddress = address.trim() || await reverseGeocode(pin.lat, pin.lng);
    addWarehouse({
      name: name.trim(),
      address: resolvedAddress,
      lat: pin.lat,
      lng: pin.lng,
    });
    toast.success(dict.admin.warehouseAdded);
    setName("");
    setAddress("");
  }

  function onAddProduct(e: React.FormEvent, warehouseId: string) {
    e.preventDefault();
    const qty = Math.max(1, Number(quantity) || 1);
    addWarehouseProduct({
      warehouse_id: warehouseId,
      name: productName.trim(),
      quantity: qty,
    });
    toast.success(`${productName.trim()} ×${qty}`);
    setProductName("");
    setQuantity("1");
    setProductTarget(null);
  }

  return (
    <AppShell title={dict.nav.warehouses}>
      <div className="flex flex-col gap-6">
          <h1 className="heading-easy">{dict.admin.warehousesTitle}</h1>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">
                <WarehouseIcon className="me-2 inline size-6" />
                {dict.admin.addWarehouse}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={onAddWarehouse} className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wh-name">{dict.admin.warehouseName}</Label>
                  <Input
                    id="wh-name"
                    className="h-11"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wh-address">{dict.admin.address}</Label>
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
                    id="wh-address"
                    className="h-11"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={dict.admin.address}
                    required={!mapsAvailable}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="lg" className="touch-target rounded-full px-6">
                    {dict.common.add}
                  </Button>
                </div>
              </form>
              <DeliveryMap
                standalone={false}
                height="260px"
                markers={[
                  ...state.warehouses.map((w) => ({
                    id: w.id,
                    lat: w.lat,
                    lng: w.lng,
                    label: w.name,
                    place: w.address,
                    kind: "warehouse" as const,
                  })),
                  { id: "new-pin", ...pin, label: dict.admin.addWarehouse, place: address, kind: "pickup" as const },
                ]}
                onMapClick={async (lat, lng) => {
                  setPin({ lat, lng });
                  setAddress(await reverseGeocode(lat, lng));
                }}
                routeHint={dict.order.mapTip}
              />
            </CardContent>
          </Card>

          {state.warehouses.map((w) => {
            const products = state.products.filter((p) => p.warehouse_id === w.id);
            return (
              <Card key={w.id} className="border-2">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-2xl">{w.name}</CardTitle>
                    <p className="mt-1 text-base text-muted-foreground">
                      {locationLabel(w.address, w.lat, w.lng)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="touch-target"
                    onClick={() => {
                      const err = removeWarehouse(w.id);
                      if (err) toast.error(err);
                      else toast.success(dict.admin.warehouseRemoved);
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    {dict.common.remove}
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-lg font-semibold">
                    <Package className="me-2 inline size-5" />
                    {dict.admin.products}
                  </p>
                  {products.length === 0 ? (
                    <p className="text-base text-muted-foreground">{dict.admin.noProducts}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {products.map((p) => {
                        const linkedOrder = p.order_id
                          ? state.orders.find((o) => o.id === p.order_id)
                          : null;
                        return (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium">{p.name}</span>
                            <Badge variant="secondary">×{p.quantity}</Badge>
                            {linkedOrder ? (
                              <Badge variant="outline" className="text-xs">
                                {dict.common.orderNumber} {formatOrderNumber(linkedOrder.order_number)}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {p.note ? (
                              <span className="text-sm text-muted-foreground">{p.note}</span>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="touch-target text-destructive hover:text-destructive"
                              aria-label={`${dict.common.remove} ${p.name}`}
                              onClick={() => removeWarehouseProduct(p.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  )}

                  {productTarget === w.id ? (
                    <form
                      onSubmit={(e) => onAddProduct(e, w.id)}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <div className="flex min-w-40 flex-1 flex-col gap-2">
                        <Label htmlFor={`prod-${w.id}`}>{dict.admin.productName}</Label>
                        <Input
                          id={`prod-${w.id}`}
                          className="h-11"
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                      <div className="flex w-24 flex-col gap-2">
                        <Label htmlFor={`qty-${w.id}`}>{dict.admin.quantity}</Label>
                        <Input
                          id={`qty-${w.id}`}
                          type="number"
                          min={1}
                          className="h-11"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" size="lg" className="touch-target rounded-full">
                        {dict.common.add}
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="ghost"
                        className="touch-target"
                        onClick={() => setProductTarget(null)}
                      >
                        {dict.common.cancel}
                      </Button>
                    </form>
                  ) : (
                    <Button
                      size="lg"
                      variant="outline"
                      className="touch-target w-fit rounded-full"
                      onClick={() => setProductTarget(w.id)}
                    >
                      {dict.admin.addProduct}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </AppShell>
  );
}
