import React from "react";
import { Pressable } from "react-native";
import { Languages, Monitor, Moon, Sun } from "lucide-react-native";
import { Row } from "./ui/layout";
import { Text } from "./ui/text";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { TOUCH_TARGET, radius } from "@/theme/tokens";

/** Language switch. Shows the language it switches *to*, like the website. */
export function LanguageToggle() {
  const { colors } = useTheme();
  const { lang, toggleLang } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}
      onPress={toggleLang}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: TOUCH_TARGET,
        paddingHorizontal: 12,
        borderRadius: radius.full,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Languages size={18} color={colors.foreground} />
      <Text variant="label" weight="semibold">
        {lang === "en" ? "عربي" : "EN"}
      </Text>
    </Pressable>
  );
}

/** Cycles system → light → dark, matching the website's toggle. */
export function ThemeToggle() {
  const { colors, preference, cyclePreference } = useTheme();
  const Icon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${preference}`}
      onPress={cyclePreference}
      hitSlop={6}
      style={({ pressed }) => ({
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.full,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={20} color={colors.foreground} />
    </Pressable>
  );
}

export function AppControls() {
  return (
    <Row gap="xs">
      <LanguageToggle />
      <ThemeToggle />
    </Row>
  );
}
