/**
 * Design tokens, transcribed from `apps/web/src/app/globals.css`.
 *
 * These are the same hex values the website ships — the two clients must not
 * drift apart — restated as plain objects because React Native has no CSS
 * variables. `design-system/direct-delivery/MASTER.md` remains the source of
 * truth for what each role means: surfaces are shades of white and black, brand
 * blue is an accent only (links, active nav, focus, map markers), gold is
 * decorative only and never a background, button, or block of text.
 */

export type ColorScheme = "light" | "dark";

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  brand: string;
  brandForeground: string;
  gold: string;
  goldSoft: string;
  /** Positive money / completed states. Not in the web palette as a token, but
      the website renders the same green for "paid" and "completed" rows. */
  success: string;
  warning: string;
  /** Scrims over map and photo surfaces. */
  overlay: string;
};

export const lightPalette: Palette = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  popover: "#ffffff",
  popoverForeground: "#0a0a0a",
  primary: "#0a0a0a",
  primaryForeground: "#ffffff",
  secondary: "#f3f3f3",
  secondaryForeground: "#0a0a0a",
  muted: "#f6f6f6",
  mutedForeground: "#575757",
  accent: "#f3f3f3",
  accentForeground: "#0a0a0a",
  destructive: "#dc2626",
  border: "#e5e5e5",
  input: "#e5e5e5",
  ring: "#0a0a0a",
  brand: "#2563eb",
  brandForeground: "#ffffff",
  gold: "#d4af37",
  goldSoft: "#f7f0da",
  success: "#15803d",
  warning: "#b45309",
  overlay: "rgba(10,10,10,0.55)",
};

export const darkPalette: Palette = {
  background: "#0a0a0a",
  foreground: "#f5f5f5",
  card: "#141414",
  cardForeground: "#f5f5f5",
  popover: "#171717",
  popoverForeground: "#f5f5f5",
  primary: "#ffffff",
  primaryForeground: "#0a0a0a",
  secondary: "#1f1f1f",
  secondaryForeground: "#f5f5f5",
  muted: "#1a1a1a",
  mutedForeground: "#a3a3a3",
  accent: "#262626",
  accentForeground: "#f5f5f5",
  destructive: "#ef4444",
  border: "#2a2a2a",
  input: "#2a2a2a",
  ring: "#d4d4d4",
  brand: "#4d82f3",
  brandForeground: "#0a0a0a",
  gold: "#e3c65b",
  goldSoft: "#2a2410",
  success: "#4ade80",
  warning: "#fbbf24",
  overlay: "rgba(0,0,0,0.65)",
};

export const palettes: Record<ColorScheme, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** MASTER.md spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

/** Derived from the web's `--radius: 0.75rem` (12px) and its multipliers. */
export const radius = {
  sm: 7,
  md: 10,
  lg: 12,
  xl: 17,
  "2xl": 22,
  "3xl": 26,
  full: 999,
} as const;

/**
 * Minimum interactive size. Every pressable in the app must clear this — the
 * web enforces it with `.touch-target`, native has to do it per component.
 */
export const TOUCH_TARGET = 44;

/** The five weights every surface can ask for, per script. */
export type FontSet = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  extrabold: string;
};

export const fontFamily: { latin: FontSet; arabic: FontSet } = {
  latin: {
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    semibold: "PlusJakartaSans_600SemiBold",
    bold: "PlusJakartaSans_700Bold",
    extrabold: "PlusJakartaSans_800ExtraBold",
  },
  arabic: {
    regular: "IBMPlexSansArabic_400Regular",
    medium: "IBMPlexSansArabic_500Medium",
    semibold: "IBMPlexSansArabic_600SemiBold",
    bold: "IBMPlexSansArabic_700Bold",
    // IBM Plex Sans Arabic has no 800; the web caps Arabic at 700 for the same
    // reason (`html[lang="ar"] .font-extrabold { font-weight: 700 }`).
    extrabold: "IBMPlexSansArabic_700Bold",
  },
};

export type FontWeightName = keyof FontSet;

/**
 * Type scale. Arabic gets zero letter-spacing and a slightly looser line box,
 * mirroring the corrections in `globals.css`.
 */
export const typeScale = {
  display: { size: 34, line: 40, tracking: -0.8 },
  title: { size: 26, line: 32, tracking: -0.5 },
  heading: { size: 20, line: 26, tracking: -0.3 },
  subheading: { size: 17, line: 24, tracking: -0.2 },
  body: { size: 16, line: 24, tracking: 0 },
  callout: { size: 15, line: 22, tracking: 0 },
  label: { size: 13, line: 18, tracking: 0.1 },
  caption: { size: 12, line: 16, tracking: 0.2 },
} as const;

export type TypeScaleName = keyof typeof typeScale;

/** MASTER.md shadow depths, expressed for both platforms. */
export function shadow(level: "sm" | "md" | "lg", scheme: ColorScheme) {
  // Elevation shadows read as mud on a near-black surface; dark mode leans on
  // the border token for separation instead.
  if (scheme === "dark") return { elevation: 0 };
  const map = {
    sm: { offset: 1, blur: 2, opacity: 0.05, elevation: 1 },
    md: { offset: 4, blur: 6, opacity: 0.1, elevation: 3 },
    lg: { offset: 10, blur: 15, opacity: 0.1, elevation: 6 },
  } as const;
  const s = map[level];
  return {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: s.offset },
    shadowOpacity: s.opacity,
    shadowRadius: s.blur,
    elevation: s.elevation,
  };
}

/** Transition budget from MASTER.md: 150–300ms. */
export const duration = { fast: 150, base: 200, slow: 300 } as const;
