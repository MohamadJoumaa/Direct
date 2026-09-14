import React from "react";
import { View, type ViewStyle } from "react-native";
import type { OrderStatus } from "@direct/shared";
import { Text } from "./text";
import { useI18n, orderStatusLabel } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

export type BadgeTone = "default" | "secondary" | "success" | "warning" | "destructive" | "brand";

export function Badge({
  label,
  tone = "secondary",
  icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, scheme } = useTheme();

  // Coloured badges are tinted, not filled: a saturated block would fight the
  // monochrome surfaces. `default` is the only solid one, matching the web's
  // `bg-primary` variant.
  const tint = scheme === "dark" ? "26" : "1a";
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    default: { bg: colors.primary, fg: colors.primaryForeground },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground },
    success: { bg: colors.success + tint, fg: colors.success },
    warning: { bg: colors.warning + tint, fg: colors.warning },
    destructive: { bg: colors.destructive + tint, fg: colors.destructive },
    brand: { bg: colors.brand + tint, fg: colors.brand },
  };
  const c = map[tone];

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: c.bg,
        },
        style,
      ]}
    >
      {icon}
      <Text variant="caption" weight="semibold" style={{ color: c.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Where each order status sits on the pipeline, for colour only. */
export function toneForOrderStatus(status: OrderStatus): BadgeTone {
  switch (status) {
    case "pending":
      return "warning";
    case "accepted":
    case "picked_up":
    case "at_warehouse":
    case "in_transit":
      return "brand";
    case "arrived":
    case "awaiting_confirmation":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
    case "disputed":
      return "destructive";
    default:
      return "secondary";
  }
}

/** Status pill that always reads in the active language. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { dict } = useI18n();
  return <Badge label={orderStatusLabel(status, dict)} tone={toneForOrderStatus(status)} />;
}
