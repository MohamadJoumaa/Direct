import React from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { typeScale, type FontWeightName, type TypeScaleName } from "@/theme/tokens";

type ColorToken =
  | "foreground"
  | "mutedForeground"
  | "primaryForeground"
  | "brand"
  | "destructive"
  | "success"
  | "warning"
  | "gold";

export type TextProps = RNTextProps & {
  variant?: TypeScaleName;
  weight?: FontWeightName;
  color?: ColorToken;
  /** Centre the line. Direction-safe: never use textAlign directly. */
  center?: boolean;
  /** Force numerals and money to read left-to-right inside an Arabic layout. */
  numeric?: boolean;
};

/**
 * Every string in the app goes through here.
 *
 * It is the one place that knows which font family the active language uses,
 * which is what keeps Arabic on IBM Plex Sans Arabic with zero tracking -- the
 * same correction `globals.css` applies on the web. Passing `fontWeight`
 * straight to React Native would silently synthesise a bold face instead of
 * picking the real one, so weight always resolves to a family name.
 */
export function Text({
  variant = "body",
  weight = "regular",
  color = "foreground",
  center,
  numeric,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const { fonts, lang } = useI18n();
  const scale = typeScale[variant];

  const base: TextStyle = {
    fontFamily: fonts[weight],
    fontSize: scale.size,
    lineHeight: scale.line,
    // Arabic letterforms connect; any tracking at all breaks the joins.
    letterSpacing: lang === "ar" ? 0 : scale.tracking,
    color: colors[color],
  };

  if (center) base.textAlign = "center";
  // Money like "$5.00 - 890,000 LBP" must not be reordered by the bidi
  // algorithm when it sits inside an Arabic paragraph.
  if (numeric) base.writingDirection = "ltr";

  return <RNText {...rest} style={[base, style]} />;
}
