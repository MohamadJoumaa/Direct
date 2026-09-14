import React, { useMemo, useState } from "react";
import { Search } from "lucide-react-native";
import { formatOrderNumber, type Order } from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { OrderCard } from "@/components/order-card";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, SegmentedControl } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

type Bucket = "pending" | "ongoing" | "history";

const ONGOING: Order["status"][] = [
  "accepted",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "arrived",
  "awaiting_confirmation",
];

/**
 * Admin order board.
 *
 * The website shows three columns side by side; a phone gets the same three
 * buckets behind a segmented control, because three parallel scroll areas do
 * not survive a 375px viewport.
 */
export function AdminOrders() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { state, claimOrder, rejectOrder, refreshFromStorage } = useStore();
  const toast = useToast();

  const [bucket, setBucket] = useState<Bucket>("pending");
  const [query, setQuery] = useState("");

  const orders = useMemo(() => {
    const byBucket = state.orders.filter((o) => {
      if (bucket === "pending") return o.status === "pending";
      if (bucket === "ongoing") return ONGOING.includes(o.status);
      return o.status === "completed" || o.status === "cancelled" || o.status === "disputed";
    });

    const needle = query.trim().toLowerCase();
    if (!needle) return byBucket;

    return byBucket.filter((o) => {
      const client = state.profiles.find((p) => p.id === o.client_id);
      return [
        formatOrderNumber(o.order_number),
        o.product_description,
        o.pickup_address,
        o.dropoff_address,
        client?.full_name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [state.orders, state.profiles, bucket, query]);

  const emptyCopy = {
    pending: dict.admin.noPending,
    ongoing: dict.admin.noOngoing,
    history: dict.admin.noHistory,
  }[bucket];

  return (
    <>
      <AppHeader title={dict.admin.allOrders} subtitle={user?.full_name} />
      <Screen onRefresh={refreshFromStorage}>
        <SegmentedControl<Bucket>
          value={bucket}
          onChange={setBucket}
          options={[
            { value: "pending", label: dict.admin.pendingOrders },
            { value: "ongoing", label: dict.admin.ongoingOrders },
            { value: "history", label: dict.admin.historyOrders },
          ]}
        />

        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={dict.common.searchOrders}
          autoCapitalize="none"
          autoCorrect={false}
          prefix={<Search size={18} color={colors.mutedForeground} />}
        />

        {orders.length === 0 ? (
          <EmptyState title={query ? dict.common.noOrderMatches : emptyCopy} />
        ) : (
          <Stack gap="sm">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  bucket === "pending" ? (
                    <Row gap="sm">
                      <Button
                        title={dict.admin.reject}
                        variant="outline"
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => {
                          const error = rejectOrder(order.id);
                          if (error) toast.error(error);
                          else toast.info(dict.admin.rejectedToast);
                        }}
                      />
                      <Button
                        title={dict.admin.takeOrder}
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => {
                          if (!user) return;
                          const error = claimOrder(order.id, user.id);
                          if (error) toast.error(error);
                          else toast.success(dict.driver.youGotTheOrder);
                        }}
                      />
                    </Row>
                  ) : undefined
                }
              />
            ))}
          </Stack>
        )}

        <Card>
          <Text variant="caption" color="mutedForeground">
            {dict.order.nearbyHint}
          </Text>
        </Card>
      </Screen>
    </>
  );
}
