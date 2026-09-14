import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { BellOff } from "lucide-react-native";
import { notificationCopy } from "@direct/i18n";
import { formatOrderNumber, type Notification } from "@direct/core";

import { Card, EmptyState } from "@/components/ui/card";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

/**
 * Notifications are stored in English; everything with a `kind` re-renders from
 * the dictionary, so an Arabic reader sees Arabic whatever language it was
 * written in. Only the destination is decided here — Expo's routes differ from
 * the website's.
 */
export default function Notifications() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { state, markNotificationsRead } = useStore();
  const router = useRouter();

  const mine = useMemo(
    () =>
      state.notifications
        .filter((n) => n.user_id === user?.id)
        .toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [state.notifications, user?.id],
  );

  // Opening the screen is the read receipt. One batched write, so a long list
  // does not commit (and persist) once per row.
  const unreadIds = mine.filter((n) => !n.read).map((n) => n.id);
  const unreadKey = unreadIds.join(",");
  useEffect(() => {
    if (unreadIds.length > 0) markNotificationsRead(unreadIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadKey]);

  function destinationFor(n: Notification): string | null {
    if (n.kind === "docs_approved") return "/profile";
    if (n.order_id) return `/orders/${n.order_id}`;
    return null;
  }

  if (mine.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={<BellOff size={32} color={colors.mutedForeground} />}
          title={dict.common.notifications}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack gap="sm">
        {mine.map((n) => {
          const copy = notificationCopy(n, dict, (orderId) => {
            const order = orderId ? state.orders.find((o) => o.id === orderId) : undefined;
            return order ? formatOrderNumber(order.order_number) : "";
          });
          const href = destinationFor(n);

          return (
            <Card
              key={n.id}
              accessibilityLabel={copy.title}
              onPress={href ? () => router.push(href as never) : undefined}
            >
              <Row gap="sm" align="flex-start">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 6,
                    borderRadius: radius.full,
                    backgroundColor: n.read ? "transparent" : colors.brand,
                  }}
                />
                <Stack gap={4} flex={1}>
                  <Text variant="callout" weight="semibold">
                    {copy.title}
                  </Text>
                  <Text variant="caption" color="mutedForeground">
                    {copy.body}
                  </Text>
                  <Text variant="caption" color="mutedForeground" numeric>
                    {new Date(n.created_at).toLocaleString()}
                  </Text>
                </Stack>
              </Row>
            </Card>
          );
        })}
      </Stack>
    </Screen>
  );
}
