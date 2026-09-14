import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import {
  darkPalette,
  lightPalette,
  palettes,
  radius,
  shadow,
  space,
  type ColorScheme,
  type Palette,
} from "./tokens";

export type ThemePreference = ColorScheme | "system";

const STORAGE_KEY = "direct-theme";

type ThemeContextValue = {
  /** What the user picked. */
  preference: ThemePreference;
  /** What is actually painted right now. */
  scheme: ColorScheme;
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  shadow: (level: "sm" | "md" | "lg") => ReturnType<typeof shadow>;
  setPreference: (next: ThemePreference) => void;
  /** Cycles system → light → dark, matching the website's theme toggle. */
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (alive && isPreference(saved)) setPreferenceState(saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  const scheme: ColorScheme =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;

  // Paints the window behind the React tree, so an overscroll bounce or a
  // slow screen transition never flashes white over the dark theme.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(
      scheme === "dark" ? darkPalette.background : lightPalette.background,
    );
  }, [scheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) => {
      const next: ThemePreference =
        prev === "system" ? "light" : prev === "light" ? "dark" : "system";
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      colors: palettes[scheme],
      space,
      radius,
      shadow: (level) => shadow(level, scheme),
      setPreference,
      cyclePreference,
    }),
    [preference, scheme, setPreference, cyclePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/** Shorthand for the common case. */
export function useColors(): Palette {
  return useTheme().colors;
}
