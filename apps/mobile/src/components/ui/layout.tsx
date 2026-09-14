import React from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme-context";
import { space as spaceScale } from "@/theme/tokens";

type SpaceKey = keyof typeof spaceScale;
type Gap = SpaceKey | number;

function gapValue(gap: Gap | undefined): number | undefined {
  if (gap == null) return undefined;
  return typeof gap === "number" ? gap : spaceScale[gap];
}

export type StackProps = ViewProps & {
  gap?: Gap;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  flex?: number;
};

/** Vertical stack. */
export function Stack({ gap, align, justify, flex, style, ...rest }: StackProps) {
  return (
    <View
      {...rest}
      style={[
        { flexDirection: "column", gap: gapValue(gap), alignItems: align, justifyContent: justify, flex },
        style,
      ]}
    />
  );
}

export type RowProps = StackProps & { wrap?: boolean };

/**
 * Horizontal row.
 *
 * Plain `flexDirection: "row"` is correct here: React Native mirrors it once
 * `I18nManager.forceRTL` is on, which `@/lib/i18n` handles at the app level.
 * Writing `row-reverse` by hand would double-flip in Arabic.
 */
export function Row({ gap, align = "center", justify, flex, wrap, style, ...rest }: RowProps) {
  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: "row",
          alignItems: align,
          justifyContent: justify,
          gap: gapValue(gap),
          flexWrap: wrap ? "wrap" : "nowrap",
          flex,
        },
        style,
      ]}
    />
  );
}

/** Pushes whatever follows it to the far end of a Row. */
export function Spacer({ size }: { size?: Gap }) {
  return <View style={size == null ? { flex: 1 } : { width: gapValue(size), height: gapValue(size) }} />;
}

export function Divider({ inset = 0, style }: { inset?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { height: 1, backgroundColor: colors.border, marginStart: inset },
        style,
      ]}
    />
  );
}
