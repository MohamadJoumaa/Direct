import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DevSettings, I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";
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
export { fmt, orderStatusLabel, orderTypeLabel } from "@direct/i18n";
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
 * React Native only mirrors layout — `flexDirection: "row"`, `start`/`end`,
 * `textAlign: "left"` — after `I18nManager.forceRTL` has been applied and the
 * JS bundle has been restarted. So switching language is a two-step move: write
 * the choice, flip the flag, then relaunch. Without the relaunch the app would
 * show Arabic strings in a left-to-right layout, which is worse than either.
 */
async function applyDirection(lang: Lang) {
  const shouldBeRtl = lang === "ar";

  // react-native-web only partially honours I18nManager: it never sets the
  // document direction, so `expo start --web` would show Arabic strings in a
  // left-to-right layout. Native has no document to set and ignores this.
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.dir = shouldBeRtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }

  // Coerced: react-native-web leaves `isRTL` undefined, and `undefined === false`
  // would report a direction change on every launch.
  if (Boolean(I18nManager.isRTL) === shouldBeRtl) return false;
  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);
  return true;
}

async function restart() {
  try {
    await Updates.reloadAsync();
  } catch {
    // reloadAsync is unavailable in some dev setups; DevSettings covers those.
    // It does not exist at all under react-native-web, where the browser
    // applies `dir` on its own and no relaunch is needed.
    if (__DEV__ && typeof DevSettings?.reload === "function") DevSettings.reload();
  }
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
      // A saved Arabic choice on a build that launched left-to-right (fresh
      // install, or the flag was cleared) needs one corrective relaunch.
      if (await applyDirection(next)) await restart();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void (async () => {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, next);
      if (await applyDirection(next)) await restart();
    })();
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "en" ? "ar" : "en";
      void (async () => {
        await AsyncStorage.setItem(LANG_STORAGE_KEY, next);
        if (await applyDirection(next)) await restart();
      })();
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

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
