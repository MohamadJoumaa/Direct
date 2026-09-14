import React from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./text";
import { useTheme } from "@/theme/theme-context";
import { TOUCH_TARGET, radius, type Palette } from "@/theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "brand";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Lucide icon element, rendered before the label. */
  icon?: React.ReactNode;
  /** Stretch to the container. Default for `lg`, which is the on-screen CTA. */
  full?: boolean;
  style?: ViewStyle;
};

const SIZES: Record<ButtonSize, { height: number; padding: number; variant: "callout" | "body" }> = {
  sm: { height: TOUCH_TARGET, padding: 14, variant: "callout" },
  md: { height: 50, padding: 18, variant: "body" },
  lg: { height: 56, padding: 22, variant: "body" },
};

function colorsFor(variant: ButtonVariant, c: Palette) {
  switch (variant) {
    case "primary":
      return { bg: c.primary, fg: c.primaryForeground, border: "transparent" };
    case "brand":
      return { bg: c.brand, fg: c.brandForeground, border: "transparent" };
    case "secondary":
      return { bg: c.secondary, fg: c.secondaryForeground, border: "transparent" };
    case "outline":
      return { bg: "transparent", fg: c.foreground, border: c.border };
    case "ghost":
      return { bg: "transparent", fg: c.foreground, border: "transparent" };
    case "destructive":
      return { bg: c.destructive, fg: "#ffffff", border: "transparent" };
  }
}

/**
 * The app's single pressable. Uber-monochrome: primary is black-on-white in
 * light mode and white-on-black in dark, brand blue stays an accent and is only
 * reachable through the explicit `brand` variant.
 *
 * Height never drops below 44pt, and the label is a real font weight rather
 * than a synthesised one (see `Text`).
 */
export function Button({
  title,
  variant = "primary",
  size = "md",
  loading,
  icon,
  full,
  disabled,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors, scheme } = useTheme();
  const tone = colorsFor(variant, colors);
  const dims = SIZES[size];
  const isDisabled = disabled || loading;
  const stretch = full ?? size === "lg";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        // A delivery handoff is a physical moment; the tap should feel like one.
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      {...rest}
      style={({ pressed }) => [
        {
          minHeight: dims.height,
          paddingHorizontal: dims.padding,
          borderRadius: radius.full,
          backgroundColor: tone.bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: tone.border,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: stretch ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
          // Uber's press feedback is a scale, not a colour change, so it reads
          // the same on a black button and a white one.
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} size="small" />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text
            variant={dims.variant}
            weight="semibold"
            style={{ color: tone.fg }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Square icon-only control, e.g. the header bell and theme toggle. */
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  tone = "plain",
  badge,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: "plain" | "filled";
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "filled" ? colors.secondary : "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
      {badge != null && badge > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            insetInlineEnd: 4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.full,
            backgroundColor: colors.brand,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="caption" weight="bold" numeric style={{ color: colors.brandForeground }}>
            {badge > 9 ? "9+" : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
