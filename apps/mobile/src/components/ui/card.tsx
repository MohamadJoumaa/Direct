import React from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Row, Stack } from "./layout";
import { Text } from "./text";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

export type CardProps = {
  children: React.ReactNode;
  /** Makes the whole card a single large tap target. */
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/**
 * The one surface in the app. Light mode separates cards from the page with a
 * soft shadow; dark mode uses the border token instead, because a shadow over
 * near-black reads as mud (see `shadow()` in the tokens).
 */
export function Card({ children, onPress, padded = true, style, accessibilityLabel }: CardProps) {
  const { colors, shadow } = useTheme();
  const body: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: padded ? space.md : 0,
    overflow: "hidden",
    ...shadow("sm"),
  };

  if (!onPress) return <View style={[body, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [body, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

/** Titled block of content with optional trailing action. */
export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="sm">
      {title ? (
        <Row justify="space-between" style={{ paddingHorizontal: space.xs }}>
          <Stack gap={2} flex={1}>
            <Text variant="heading" weight="bold">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="label" color="mutedForeground">
                {subtitle}
              </Text>
            ) : null}
          </Stack>
          {action}
        </Row>
      ) : null}
      {children}
    </Stack>
  );
}

/** A tappable settings-style line. */
export function ListRow({
  icon,
  label,
  value,
  onPress,
  destructive,
  last,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const { dir } = useI18n();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed && onPress ? colors.muted : "transparent",
      })}
    >
      <Row gap="sm">
        {icon}
        <Text
          variant="callout"
          weight="medium"
          color={destructive ? "destructive" : "foreground"}
          style={{ flex: 1 }}
        >
          {label}
        </Text>
        {value ? (
          <Text variant="callout" color="mutedForeground" numeric numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {onPress ? (
          <ChevronRight
            size={18}
            color={colors.mutedForeground}
            // Lucide chevrons do not mirror themselves; RTL has to flip it.
            style={{ transform: [{ scaleX: dir === "rtl" ? -1 : 1 }] }}
          />
        ) : null}
      </Row>
    </Pressable>
  );
}

/** Grouped `ListRow`s inside one rounded surface. */
export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <Card padded={false}>
      <View>{children}</View>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack gap="md" align="center" style={{ paddingVertical: space.xl, paddingHorizontal: space.lg }}>
      {icon}
      <Stack gap="xs" align="center">
        <Text variant="subheading" weight="semibold" center>
          {title}
        </Text>
        {body ? (
          <Text variant="callout" color="mutedForeground" center>
            {body}
          </Text>
        ) : null}
      </Stack>
      {action}
    </Stack>
  );
}

/** Compact number tile used across the dashboards. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "brand";
}) {
  const colorFor = {
    default: "foreground",
    success: "success",
    warning: "warning",
    destructive: "destructive",
    brand: "brand",
  } as const;

  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Stack gap="xs">
        <Text variant="label" color="mutedForeground" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="title" weight="bold" numeric color={colorFor[tone]} numberOfLines={1}>
          {value}
        </Text>
        {hint ? (
          <Text variant="caption" color="mutedForeground" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
