import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowDown, Clock, Zap } from "lucide-react-native";
import { formatDeliveryCash } from "@direct/shared";
import { formatOrderNumber, locationLabel, type Order } from "@direct/core";

import { Badge, OrderStatusBadge } from "./ui/badge";
import { Card } from "./ui/card";
import { Row, Stack } from "./ui/layout";
import { Text } from "./ui/text";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

/**
 * One order, everywhere it appears: client home, history, driver jobs, admin
 * list. Keeping a single card means a status or price rule only has to be got
 * right once.
 */
export function OrderCard({
  order,
  /** Extra line under the route, e.g. "2.4 km to pickup". */
  footnote,
  /** Actions rendered at the bottom, e.g. Accept / Decline. */
  actions,
  onPress,
}: {
  order: Order;
  footnote?: string;
  actions?: React.ReactNode;
  onPress?: () => void;
}) {
  const { dict, lang } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();

  const open = onPress ?? (() => router.push(`/orders/${order.id}`));

  // Actions live outside the pressable region, not inside it. A control nested
  // in another control is announced as one confusing target by VoiceOver and
  // TalkBack, and react-native-web renders it as a `<button>` inside a
  // `<button>`, which is invalid DOM.
  return (
    <Card padded={false} style={{ padding: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={formatOrderNumber(order.order_number)}
        onPress={open}
        style={({ pressed }) => ({ padding: space.md, opacity: pressed ? 0.7 : 1 })}
      >
        <Stack gap="sm">
        <Row gap="sm" justify="space-between">
          <Row gap="xs">
            <Text variant="label" weight="bold" numeric>
              {formatOrderNumber(order.order_number)}
            </Text>
            {order.is_urgent ? (
              <Badge
                label={dict.order.urgentBadge}
                tone="destructive"
                icon={<Zap size={11} color={colors.destructive} />}
              />
            ) : null}
          </Row>
          <OrderStatusBadge status={order.status} />
        </Row>

        <Text variant="subheading" weight="semibold" numberOfLines={1}>
          {order.product_description}
        </Text>

        <RouteLine
          from={locationLabel(order.pickup_address, order.pickup_lat, order.pickup_lng, lang)}
          to={locationLabel(order.dropoff_address, order.dropoff_lat, order.dropoff_lng, lang)}
        />

        <Row gap="sm" justify="space-between">
          <Text variant="callout" weight="semibold" numeric>
            {formatDeliveryCash(order.delivery_fee_usd, order.delivery_fee_lbp)}
          </Text>
          {order.eta_minutes != null ? (
            <Row gap="xs">
              <Clock size={13} color={colors.mutedForeground} />
              <Text variant="caption" color="mutedForeground" numeric>
                {order.eta_minutes} {dict.common.minutes}
              </Text>
            </Row>
          ) : null}
        </Row>

          {footnote ? (
            <Text variant="caption" color="mutedForeground" numberOfLines={1}>
              {footnote}
            </Text>
          ) : null}
        </Stack>
      </Pressable>

      {actions ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>{actions}</View>
      ) : null}
    </Card>
  );
}

/**
 * Pickup above drop-off, joined by a rail.
 *
 * Reads as a journey at a glance, and unlike a "A → B" line it never has to
 * truncate one of the two places to fit a phone's width.
 */
export function RouteLine({ from, to }: { from: string; to: string }) {
  const { colors } = useTheme();

  return (
    <Row gap="sm" align="stretch">
      <Stack align="center" style={{ width: 12, paddingVertical: 4 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: colors.foreground,
          }}
        />
        <View style={{ flex: 1, width: 1, backgroundColor: colors.border, minHeight: 14 }} />
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: colors.foreground,
          }}
        />
      </Stack>
      <Stack gap="sm" flex={1}>
        <Text variant="callout" color="mutedForeground" numberOfLines={1}>
          {from}
        </Text>
        <Text variant="callout" numberOfLines={1}>
          {to}
        </Text>
      </Stack>
    </Row>
  );
}

/** Compact two-line route for dense rows (admin tables, driver route stops). */
export function CompactRoute({ from, to }: { from: string; to: string }) {
  const { colors } = useTheme();
  return (
    <Stack gap={2}>
      <Text variant="caption" color="mutedForeground" numberOfLines={1}>
        {from}
      </Text>
      <Row gap="xs">
        <ArrowDown size={11} color={colors.mutedForeground} />
        <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
          {to}
        </Text>
      </Row>
    </Stack>
  );
}
