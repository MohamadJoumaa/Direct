import React, { useMemo, useState } from "react";
import { Search } from "lucide-react-native";
import { formatDeliveryCash } from "@direct/shared";
import { formatOrderNumber, ordersForOwner, type Order } from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { OrderCard } from "@/components/order-card";
import { Card, EmptyState, Stat } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

const DONE: Order["status"][] = ["completed", "cancelled", "disputed"];

/** Past orders, from whichever side the signed-in role sits on. */
export default function History() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user, effectiveRole } = useAuth();
  const { state, refreshFromStorage } = useStore();
  const [query, setQuery] = useState("");

  const isDriver = effectiveRole === "driver";

  const orders = useMemo(() => {
    if (!user) return [];
    const mine = isDriver
      ? state.orders.filter(
          (o) => o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id,
        )
      : ordersForOwner(state, user.id);

    const done = mine.filter((o) => DONE.includes(o.status));
    const needle = query.trim().toLowerCase();
    if (!needle) return done;
    return done.filter((o) =>
      [formatOrderNumber(o.order_number), o.product_description, o.dropoff_address]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [state, user, isDriver, query]);

  const completed = orders.filter((o) => o.status === "completed");
  const earned = completed.reduce(
    (sum, o) => sum + (isDriver ? o.driver_cut_usd : o.delivery_fee_usd),
    0,
  );

  return (
    <>
      <AppHeader title={isDriver ? dict.driver.pastJobs : dict.client.pastDeliveries} />
      <Screen onRefresh={refreshFromStorage}>
        <Row gap="sm">
          <Stat label={dict.common.orders} value={String(completed.length)} />
          <Stat
            label={isDriver ? dict.driver.yourPay : dict.common.total}
            value={formatDeliveryCash(earned)}
            tone={isDriver ? "success" : "default"}
          />
        </Row>

        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={dict.common.searchOrders}
          autoCapitalize="none"
          autoCorrect={false}
          prefix={<Search size={18} color={colors.mutedForeground} />}
        />

        {orders.length === 0 ? (
          <EmptyState
            title={
              query
                ? dict.common.noOrderMatches
                : isDriver
                  ? dict.driver.noCompleted
                  : dict.client.noCompleted
            }
          />
        ) : (
          <Stack gap="sm">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </Stack>
        )}

        <Card>
          <Text variant="caption" color="mutedForeground">
            {dict.order.cashNote}
          </Text>
        </Card>
      </Screen>
    </>
  );
}
