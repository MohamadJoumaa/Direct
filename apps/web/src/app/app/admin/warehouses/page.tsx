"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Trash2, User, Warehouse as WarehouseIcon } from "lucide-react";
import { MapsProvider, PlaceSearch, hasMapsKey, useMapsAvailable } from "@/components/maps-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { formatOrderNumber } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";

type SelectedPlace = { address: string; lat: number; lng: number };

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
    updateWarehouse,
    removeWarehouse,
    addWarehouseProduct,
    removeWarehouseProduct,
  } = useStore();
  const { dict, lang } = useI18n();
  const mapsAvailable = useMapsAvailable();

  const [name, setName] = useState("");
  const [place, setPlace] = useState<SelectedPlace | null>(null);
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productTarget, setProductTarget] = useState<string | null>(null);
  // Which warehouse is open for editing, plus the draft being typed into it.
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlace, setEditPlace] = useState<SelectedPlace | null>(null);

  if (!isAdmin) {
    return (
        <p className="text-easy">{dict.common.adminOnly}</p>
    );
  }

  function onAddWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!place) return;
    addWarehouse({
      name: name.trim(),
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    toast.success(dict.admin.warehouseAdded);
    setName("");
    setPlace(null);
  }

  function startEdit(w: SelectedPlace & { id: string; name: string }) {
    setEditTarget(w.id);
    setEditName(w.name);
    setEditPlace({ address: w.address, lat: w.lat, lng: w.lng });
  }

  function onSaveWarehouse(e: React.FormEvent, warehouseId: string) {
    e.preventDefault();
    if (!editPlace) return;
    const err = updateWarehouse(warehouseId, {
      name: editName,
      address: editPlace.address,
      lat: editPlace.lat,
      lng: editPlace.lng,
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.admin.warehouseUpdated);
    setEditTarget(null);
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
              {mapsAvailable ? (
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
                    <PlaceSearch
                      placeholder={dict.order.searchPlace}
                      className="h-11"
                      onSelect={(selected) => setPlace(selected)}
                    />
                    {/* Reflects the selected place only — free text can never
                        silently save the wrong pin. */}
                    <Input
                      id="wh-address"
                      className="h-11"
                      value={place ? locationLabel(place.address, place.lat, place.lng, lang) : ""}
                      placeholder={dict.admin.selectPlaceRequired}
                      readOnly
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="touch-target rounded-full px-6"
                      disabled={!place}
                    >
                      {dict.common.add}
                    </Button>
                  </div>
                </form>
              ) : (
                <Empty className="rounded-xl border border-dashed bg-muted">
                  <EmptyHeader>
                    <EmptyTitle className="text-lg">{dict.admin.addWarehouse}</EmptyTitle>
                    <EmptyDescription className="text-base">
                      {hasMapsKey() ? dict.client.mapsAuthFailed : dict.client.mapsMissingKey}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
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
                      {locationLabel(w.address, w.lat, w.lng, lang)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="touch-target"
                      onClick={() => (editTarget === w.id ? setEditTarget(null) : startEdit(w))}
                    >
                      <Pencil data-icon="inline-start" />
                      {dict.common.edit}
                    </Button>
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
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {editTarget === w.id ? (
                    <form
                      onSubmit={(e) => onSaveWarehouse(e, w.id)}
                      className="grid gap-4 rounded-xl border-2 border-dashed p-4 sm:grid-cols-2"
                    >
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`wh-edit-name-${w.id}`}>{dict.admin.warehouseName}</Label>
                        <Input
                          id={`wh-edit-name-${w.id}`}
                          className="h-11"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`wh-edit-address-${w.id}`}>{dict.admin.address}</Label>
                        {mapsAvailable ? (
                          <PlaceSearch
                            placeholder={dict.order.searchPlace}
                            className="h-11"
                            onSelect={(selected) => setEditPlace(selected)}
                          />
                        ) : null}
                        {/* Shows the place actually saved, so the pin and its
                            label can never drift apart. */}
                        <Input
                          id={`wh-edit-address-${w.id}`}
                          className="h-11"
                          value={
                            editPlace
                              ? locationLabel(editPlace.address, editPlace.lat, editPlace.lng, lang)
                              : ""
                          }
                          placeholder={dict.admin.selectPlaceRequired}
                          readOnly
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <Button
                          type="submit"
                          size="lg"
                          className="touch-target rounded-full px-6"
                          disabled={!editPlace}
                        >
                          {dict.admin.saveWarehouse}
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          variant="ghost"
                          className="touch-target"
                          onClick={() => setEditTarget(null)}
                        >
                          {dict.common.cancel}
                        </Button>
                      </div>
                    </form>
                  ) : null}
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-medium">{p.name}</span>
                            <Badge variant="secondary">×{p.quantity}</Badge>
                            {linkedOrder ? (
                              <Badge variant="outline" className="text-xs">
                                {dict.common.orderNumber} {formatOrderNumber(linkedOrder.order_number)}
                              </Badge>
                            ) : null}
                            {p.delivered_by_name ? (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <User className="size-3" />
                                {dict.admin.deliveredBy} {p.delivered_by_name}
                                {p.delivered_at
                                  ? ` ${dict.admin.deliveredOn} ${new Date(p.delivered_at).toLocaleDateString()}`
                                  : ""}
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
  );
}
