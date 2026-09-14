import React, { useState } from "react";
import {
  Pressable,
  Switch,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Check } from "lucide-react-native";
import { Row, Stack } from "./layout";
import { Text } from "./text";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { TOUCH_TARGET, radius, space, typeScale } from "@/theme/tokens";

export type FieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  /** Reserved leading content, e.g. a currency symbol. */
  prefix?: React.ReactNode;
  /** Trailing content, e.g. a reveal-password toggle or a unit. */
  suffix?: React.ReactNode;
  containerStyle?: ViewStyle;
};

/**
 * Labelled text input.
 *
 * The focus ring is drawn with the `ring` token rather than the platform
 * default so the visible-focus requirement in MASTER.md holds on both
 * platforms, and the field inherits the active language's font and direction.
 */
export function Field({
  label,
  hint,
  error,
  prefix,
  suffix,
  containerStyle,
  style,
  multiline,
  ...rest
}: FieldProps) {
  const { colors } = useTheme();
  const { fonts, dir } = useI18n();
  const [focused, setFocused] = useState(false);

  return (
    <Stack gap="xs" style={containerStyle}>
      {label ? (
        <Text variant="label" weight="medium" color="mutedForeground">
          {label}
        </Text>
      ) : null}

      <Row
        gap="sm"
        align={multiline ? "flex-start" : "center"}
        style={{
          minHeight: multiline ? 96 : 52,
          paddingHorizontal: space.md,
          paddingVertical: multiline ? 12 : 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: error ? colors.destructive : focused ? colors.ring : colors.input,
          backgroundColor: colors.card,
        }}
      >
        {prefix}
        <TextInput
          {...rest}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.mutedForeground}
          style={[
            {
              flex: 1,
              color: colors.foreground,
              fontFamily: fonts.regular,
              fontSize: typeScale.body.size,
              lineHeight: multiline ? typeScale.body.line : undefined,
              paddingVertical: multiline ? 0 : 14,
              textAlign: dir === "rtl" ? "right" : "left",
              // Android draws its own underline inside the bordered box.
              textAlignVertical: multiline ? "top" : "center",
            },
            style,
          ]}
        />
        {suffix}
      </Row>

      {error ? (
        <Text variant="caption" color="destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="mutedForeground">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

/** Toggle row, for booleans that apply immediately. */
export function SwitchField({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row gap="md" style={{ minHeight: TOUCH_TARGET, opacity: disabled ? 0.5 : 1 }}>
      <Stack gap={2} flex={1}>
        <Text variant="callout" weight="medium">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color="mutedForeground">
            {hint}
          </Text>
        ) : null}
      </Stack>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.input, true: colors.primary }}
        thumbColor={colors.card}
      />
    </Row>
  );
}

export type Option<T extends string> = { value: T; label: string; hint?: string };

/**
 * Inline single-choice list.
 *
 * A native picker wheel hides the other options behind a tap; on a delivery
 * form every choice changes the price, so they all stay visible.
 */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label?: string;
  options: Option<T>[];
  value: T | null;
  onChange: (next: T) => void;
  /** Lay the options out side by side instead of stacked. */
  columns?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Stack gap="xs">
      {label ? (
        <Text variant="label" weight="medium" color="mutedForeground">
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: columns ? "row" : "column", gap: space.sm, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => ({
                flex: columns ? 1 : undefined,
                minWidth: columns ? 140 : undefined,
                minHeight: TOUCH_TARGET + 8,
                justifyContent: "center",
                paddingHorizontal: space.md,
                paddingVertical: 12,
                borderRadius: radius.lg,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.ring : colors.border,
                backgroundColor: selected ? colors.muted : colors.card,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Row gap="sm">
                <Stack gap={2} flex={1}>
                  <Text variant="callout" weight={selected ? "semibold" : "regular"}>
                    {opt.label}
                  </Text>
                  {opt.hint ? (
                    <Text variant="caption" color="mutedForeground">
                      {opt.hint}
                    </Text>
                  ) : null}
                </Stack>
                {selected ? <Check size={18} color={colors.foreground} /> : null}
              </Row>
            </Pressable>
          );
        })}
      </View>
    </Stack>
  );
}

/** Compact horizontal switcher, e.g. history filters. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <Row
      style={{
        padding: 3,
        borderRadius: radius.full,
        backgroundColor: colors.secondary,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.full,
              backgroundColor: selected ? colors.card : "transparent",
            }}
          >
            <Text
              variant="label"
              weight={selected ? "semibold" : "medium"}
              color={selected ? "foreground" : "mutedForeground"}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}
