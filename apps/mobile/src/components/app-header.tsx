import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronDown, Eye } from "lucide-react-native";
import { USER_ROLES, type UserRole } from "@direct/shared";
import type { Dictionary } from "@direct/i18n";

import { IconButton } from "./ui/button";
import { Row, Stack } from "./ui/layout";
import { Sheet } from "./ui/sheet";
import { Text } from "./ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

/**
 * In-app header.
 *
 * Tab screens draw their own header instead of using the navigator's, so the
 * title can sit on the same line as the notification bell and the admin's
 * "view as" control without a second stacked bar eating vertical space.
 */
export function AppHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { dict } = useI18n();
  const { user, isAdmin } = useAuth();
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const unread = useMemo(
    () => state.notifications.filter((n) => n.user_id === user?.id && !n.read).length,
    [state.notifications, user?.id],
  );

  return (
    <View
      style={{
        paddingTop: insets.top + space.sm,
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
        backgroundColor: colors.background,
      }}
    >
      <Row gap="sm" align="flex-start">
        <Stack gap={2} flex={1}>
          <Text variant="title" weight="extrabold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" color="mutedForeground" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Stack>

        {action}
        {isAdmin ? <ViewAsControl /> : null}

        <IconButton
          accessibilityLabel={dict.common.notifications}
          onPress={() => router.push("/notifications")}
          badge={unread}
        >
          <Bell size={20} color={colors.foreground} />
        </IconButton>
      </Row>
    </View>
  );
}

/**
 * Admin impersonation.
 *
 * Selecting a role also selects a representative profile of that role, because
 * `viewingAs` alone would leave every impersonated screen running under the
 * admin's own id — the same rule the website enforces.
 */
function ViewAsControl() {
  const { colors } = useTheme();
  const { dict } = useI18n();
  const { state, setViewingAs } = useStore();
  const [open, setOpen] = useState(false);

  const current = state.viewingAs;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dict.admin.viewAsTitle}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 36,
          paddingHorizontal: 10,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: current ? colors.brand : colors.border,
          backgroundColor: current ? colors.brand + "1a" : "transparent",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Eye size={15} color={current ? colors.brand : colors.mutedForeground} />
        <Text
          variant="caption"
          weight="semibold"
          color={current ? "brand" : "mutedForeground"}
          numberOfLines={1}
        >
          {viewAsLabel(current, dict)}
        </Text>
        <ChevronDown size={13} color={current ? colors.brand : colors.mutedForeground} />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} title={dict.admin.viewAsTitle}>
        <Stack gap="sm">
          <ViewAsOption
            label={viewAsLabel(null, dict)}
            selected={current == null}
            onPress={() => {
              setViewingAs(null);
              setOpen(false);
            }}
          />
          {USER_ROLES.filter((r) => r !== "admin").map((role: UserRole) => (
            <ViewAsOption
              key={role}
              label={viewAsLabel(role, dict)}
              selected={current === role}
              onPress={() => {
                setViewingAs(role);
                setOpen(false);
              }}
            />
          ))}
        </Stack>
      </Sheet>
    </>
  );
}

function ViewAsOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        justifyContent: "center",
        paddingHorizontal: space.md,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.ring : colors.border,
        backgroundColor: pressed ? colors.muted : colors.card,
      })}
    >
      <Text variant="body" weight={selected ? "semibold" : "regular"}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The website labels these "Admin view" / "Client view" and so do we. */
function viewAsLabel(role: UserRole | null, dict: Dictionary): string {
  switch (role) {
    case "client":
      return dict.admin.viewAsClient;
    case "business":
      return dict.admin.viewAsBusiness;
    case "driver":
      return dict.admin.viewAsDriver;
    default:
      return dict.admin.viewAsAdmin;
  }
}
