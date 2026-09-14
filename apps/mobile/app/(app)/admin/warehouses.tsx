import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react-native";

import { LocationField, LocationPicker, type PickedLocation } from "@/components/map/location-picker";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

/**
 * Hubs for the long-distance hop.
 *
 * Products held here are what a driver handed in mid-route; an admin can also
 * type stock in directly, which is why a product may have no delivering driver.
 */
export default function AdminWarehouses() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { state, addWarehouse, removeWarehouse, removeWarehouseProduct } = useStore();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <Screen
        footer={
          <Button
            title={dict.admin.addWarehouse}
            size="lg"
            icon={<Plus size={18} color={colors.primaryForeground} />}
            onPress={() => setAddOpen(true)}
          />
        }
      >
        {state.warehouses.length === 0 ? (
          <EmptyState title={dict.admin.warehousesTitle} body={dict.admin.noProducts} />
        ) : (
          <Stack gap="md">
            {state.warehouses.map((warehouse) => {
              const products = state.products.filter((p) => p.warehouse_id === warehouse.id);
              return (
                <Card key={warehouse.id}>
                  <Stack gap="sm">
                    <Row gap="sm" justify="space-between">
                      <Stack gap={2} flex={1}>
                        <Text variant="subheading" weight="semibold" numberOfLines={1}>
                          {warehouse.name}
                        </Text>
                        <Text variant="caption" color="mutedForeground" numberOfLines={2}>
                          {warehouse.address}
                        </Text>
                      </Stack>
                      <IconButton
                        accessibilityLabel={dict.common.remove}
                        onPress={() => {
                          const error = removeWarehouse(warehouse.id);
                          if (error) toast.error(error);
                          else toast.success(dict.admin.warehouseRemoved);
                        }}
                      >
                        <Trash2 size={18} color={colors.destructive} />
                      </IconButton>
                    </Row>

                    <Divider />

                    <Text variant="label" weight="semibold" color="mutedForeground">
                      {dict.admin.products}
                    </Text>
                    {products.length === 0 ? (
                      <Text variant="caption" color="mutedForeground">
                        {dict.admin.noProducts}
                      </Text>
                    ) : (
                      products.map((product) => (
                        <Row key={product.id} gap="sm" justify="space-between">
                          <Stack gap={2} flex={1}>
                            <Text variant="callout" numberOfLines={1}>
                              {product.name}
                            </Text>
                            {product.delivered_by_name ? (
                              <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                                {dict.admin.deliveredBy} {product.delivered_by_name}
                              </Text>
                            ) : null}
                          </Stack>
                          <Text variant="callout" weight="semibold" numeric>
                            ×{product.quantity}
                          </Text>
                          <IconButton
                            accessibilityLabel={dict.common.remove}
                            onPress={() => removeWarehouseProduct(product.id)}
                          >
                            <Trash2 size={16} color={colors.mutedForeground} />
                          </IconButton>
                        </Row>
                      ))
                    )}
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Screen>

      <AddWarehouseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(name, place) => {
          addWarehouse({ name, address: place.label, lat: place.lat, lng: place.lng });
          toast.success(dict.admin.warehouseAdded);
          setAddOpen(false);
        }}
      />
    </>
  );
}

function AddWarehouseSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, place: PickedLocation) => void;
}) {
  const { dict } = useI18n();
  const [name, setName] = useState("");
  const [place, setPlace] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={dict.admin.addWarehouse}
        footer={
          <Button
            title={dict.common.add}
            size="lg"
            disabled={!name.trim() || !place}
            onPress={() => {
              if (!place) return;
              onAdd(name.trim(), place);
              setName("");
              setPlace(null);
            }}
          />
        }
      >
        <Field label={dict.admin.warehouseName} value={name} onChangeText={setName} />
        <LocationField
          label={dict.admin.address}
          value={place?.label}
          placeholder={dict.admin.shopPinHint}
          onPress={() => setPickerOpen(true)}
        />
      </Sheet>

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={setPlace}
        title={dict.admin.address}
        initial={place}
      />
    </>
  );
}
