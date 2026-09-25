import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager, Platform, View, type ViewProps, type ViewStyle } from "react-native";
import {
  DICTS,
  LANG_STORAGE_KEY,
  dirForLang,
  isLang,
  type Dictionary,
  type Lang,
} from "@direct/i18n";
import { fontFamily, type FontSet } from "@/theme/tokens";

// Dictionaries come from @direct/i18n so the phone and the website read the
// same copy. Only direction handling is native-specific.
export {
  fmt,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatTime,
  orderStatusLabel,
  orderTypeLabel,
} from "@direct/i18n";
export type { Dictionary, Lang };

type I18nContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  /** False until the saved language has been read back from storage. */
  langReady: boolean;
  /** Font family names for the active language. */
  fonts: FontSet;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Persist the direction for the *next* cold start.
 *
 * `I18nManager.forceRTL` does not take effect in the running process: it writes
 * a native preference that is read when the app launches. That is the whole
 * story behind the bug this replaced — switching to English flipped the flag,
 * asked for a relaunch, and the relaunch either never happened (Expo Go cannot
 * `reloadAsync`, and a JS-only reload does not re-read the preference) or was
 * not enough, so the app kept laying itself out right-to-left with English
 * text in it.
 *
 * So the flag is no longer what mirrors the app — `dir` on the tree is (see
 * `DirectionRoot`). It is still written, for the things React does not own:
 * the native stack header's back arrow, the system context menus, and the
 * first frame of the next launch, which is laid out before any JS runs.
 */
function persistNativeDirection(lang: Lang) {
  const shouldBeRtl = lang === "ar";

  // react-native-web only partially honours I18nManager: it never sets the
  // document direction, so `expo start --web` would show Arabic strings in a
  // left-to-right layout. Native has no document to set and ignores this.
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.dir = shouldBeRtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }

  // Coerced: react-native-web leaves `isRTL` undefined, and `undefined === false`
  // would write the preference on every launch.
  if (Boolean(I18nManager.isRTL) === shouldBeRtl) return;
  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The device already knows its direction from the last launch, so start from
  // that rather than defaulting to English and flashing the wrong layout.
  const [lang, setLangState] = useState<Lang>(I18nManager.isRTL ? "ar" : "en");
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = await AsyncStorage.getItem(LANG_STORAGE_KEY);
      if (!alive) return;
      const next = isLang(saved) ? saved : I18nManager.isRTL ? "ar" : "en";
      setLangState(next);
      setLangReady(true);
      persistNativeDirection(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // No relaunch: `dir` is React state now, so the layout turns around on the
  // next render. Everything below is just persistence.
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistNativeDirection(next);
    void AsyncStorage.setItem(LANG_STORAGE_KEY, next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "en" ? "ar" : "en";
      persistNativeDirection(next);
      void AsyncStorage.setItem(LANG_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      dir: dirForLang(lang),
      dict: DICTS[lang],
      langReady,
      fonts: lang === "ar" ? fontFamily.arabic : fontFamily.latin,
      setLang,
      toggleLang,
    }),
    [lang, langReady, setLang, toggleLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Wraps a subtree in the active language's writing direction.
 *
 * Yoga's `direction` is what mirrors `flexDirection: "row"`, `marginStart`,
 * `paddingEnd` and the `insetInline*` props, and it is inherited, so one of
 * these at a tree's root turns the whole tree around on the next render — no
 * native flag, no relaunch, and correct even while `I18nManager.isRTL` still
 * holds the previous launch's answer. It is an absolute value rather than a
 * toggle, so it cannot double-mirror an already-RTL surface.
 *
 * Every root needs one, and a `Modal` is its own root: it is hosted outside the
 * React tree it was written in, so it inherits nothing from the app frame.
 * That is why `Sheet` and `LocationPicker` each wrap their contents in one too.
 */
export function DirectionRoot({
  children,
  style,
  onLayout,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onLayout?: ViewProps["onLayout"];
}) {
  const { dir } = useI18n();
  return (
    <View style={[{ flex: 1, direction: dir }, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
