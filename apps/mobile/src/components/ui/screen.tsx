import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme-context";
import { space } from "@/theme/tokens";
import { Stack } from "./layout";

export type ScreenProps = {
  children: React.ReactNode;
  /** Set false for screens that own their own scrolling (maps, FlatLists). */
  scroll?: boolean;
  /** Pull-to-refresh. Omit to disable. */
  onRefresh?: () => void;
  refreshing?: boolean;
  gap?: keyof typeof space | number;
  /** Content pinned to the bottom above the safe area, e.g. a primary CTA. */
  footer?: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * Page chrome: safe areas, keyboard avoidance, and the bottom action slot.
 *
 * The footer sits outside the scroll view so a primary action stays reachable
 * with one thumb no matter how long the page is -- the single biggest
 * difference between this and the website's layout.
 */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  gap = "md",
  footer,
  padded = true,
  style,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? space.md : 0;

  const body = (
    <Stack gap={gap} style={{ padding: pad, paddingBottom: pad + space.lg }}>
      {children}
    </Stack>
  );

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.mutedForeground}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}

      {footer ? (
        <View
          style={{
            padding: space.md,
            paddingBottom: Math.max(insets.bottom, space.md),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
