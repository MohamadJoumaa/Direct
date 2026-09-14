import React, { useState } from "react";
import { formatDeliveryCash, withBusinessOrderCosts } from "@direct/shared";
import type { Profile } from "@direct/core";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";

/**
 * Per-business fare floor and ceiling.
 *
 * These clamp the quote before urgent pricing is applied, which is why the ×3
 * can still exceed a business's ceiling — deliberately.
 */
export default function AdminBusinesses() {
  const { dict } = useI18n();
  const { state } = useStore();
  const [editing, setEditing] = useState<Profile | null>(null);

  const businesses = state.profiles.filter((p) => p.role === "business");

  return (
    <>
      <Screen>
        <Text variant="callout" color="mutedForeground">
          {dict.admin.orderCostsBody}
        </Text>

        {businesses.length === 0 ? (
          <EmptyState title={dict.admin.noBusinesses} />
        ) : (
          <Stack gap="sm">
            {businesses.map((business) => {
              const costs = withBusinessOrderCosts(business);
              return (
                <Card key={business.id} onPress={() => setEditing(business)}>
                  <Stack gap="sm">
                    <Stack gap={2}>
                      <Text variant="subheading" weight="semibold" numberOfLines={1}>
                        {business.business_name ?? business.full_name}
                      </Text>
                      <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                        {business.business_address ?? dict.admin.shopPinHint}
                      </Text>
                    </Stack>
                    <Divider />
                    <Row justify="space-between">
                      <Text variant="caption" color="mutedForeground">
                        {dict.admin.minUsd}
                      </Text>
                      <Text variant="caption" weight="semibold" numeric>
                        {formatDeliveryCash(costs.order_min_usd, costs.order_min_lbp)}
                      </Text>
                    </Row>
                    <Row justify="space-between">
                      <Text variant="caption" color="mutedForeground">
                        {dict.admin.maxUsd}
                      </Text>
                      <Text variant="caption" weight="semibold" numeric>
                        {formatDeliveryCash(costs.order_max_usd, costs.order_max_lbp)}
                      </Text>
                    </Row>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Screen>

      <CostsSheet business={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function CostsSheet({ business, onClose }: { business: Profile | null; onClose: () => void }) {
  const { dict } = useI18n();
  const { updateBusinessOrderCosts } = useStore();
  const toast = useToast();

  const costs = withBusinessOrderCosts(business);
  const [minUsd, setMinUsd] = useState(String(costs.order_min_usd));
  const [maxUsd, setMaxUsd] = useState(String(costs.order_max_usd));
  const [minLbp, setMinLbp] = useState(String(costs.order_min_lbp));
  const [maxLbp, setMaxLbp] = useState(String(costs.order_max_lbp));

  // Re-seed the fields each time a different business is opened.
  const key = business?.id ?? "";
  React.useEffect(() => {
    const next = withBusinessOrderCosts(business);
    setMinUsd(String(next.order_min_usd));
    setMaxUsd(String(next.order_max_usd));
    setMinLbp(String(next.order_min_lbp));
    setMaxLbp(String(next.order_max_lbp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function save() {
    if (!business) return;
    // `updateBusinessOrderCosts` runs `validateBusinessOrderCosts`, so an
    // inverted or negative range comes back as an error string, not a bad save.
    const error = updateBusinessOrderCosts(business.id, {
      order_min_usd: Number(minUsd),
      order_max_usd: Number(maxUsd),
      order_min_lbp: Number(minLbp),
      order_max_lbp: Number(maxLbp),
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(dict.admin.costsSaved);
    onClose();
  }

  return (
    <Sheet
      open={business != null}
      onClose={onClose}
      title={dict.admin.orderCostsTitle}
      subtitle={business?.business_name ?? undefined}
      footer={<Button title={dict.admin.saveCosts} size="lg" onPress={save} />}
    >
      <Row gap="sm">
        <Field
          containerStyle={{ flex: 1 }}
          label={dict.admin.minUsd}
          value={minUsd}
          onChangeText={setMinUsd}
          keyboardType="decimal-pad"
        />
        <Field
          containerStyle={{ flex: 1 }}
          label={dict.admin.maxUsd}
          value={maxUsd}
          onChangeText={setMaxUsd}
          keyboardType="decimal-pad"
        />
      </Row>
      <Row gap="sm">
        <Field
          containerStyle={{ flex: 1 }}
          label={dict.admin.minLbp}
          value={minLbp}
          onChangeText={setMinLbp}
          keyboardType="number-pad"
        />
        <Field
          containerStyle={{ flex: 1 }}
          label={dict.admin.maxLbp}
          value={maxLbp}
          onChangeText={setMaxLbp}
          keyboardType="number-pad"
        />
      </Row>
    </Sheet>
  );
}
