"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DICTS,
  LANG_STORAGE_KEY,
  dirForLang,
  isLang,
  type Dictionary,
  type Lang,
} from "@direct/i18n";

// Dictionaries and the pure string helpers live in @direct/i18n so Expo reads
// the same copy; only this provider — which drives the document direction — is
// web-specific. Pages keep importing everything from "@/lib/i18n".
export { fmt, orderStatusLabel, orderTypeLabel } from "@direct/i18n";
export type { Dictionary, Lang };

type I18nContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  /** False until the saved language has been read back from storage. */
  langReady: boolean;
  toggleLang: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  // The server always renders English, so the saved choice can only land after
  // hydration. Anything that can be configured just once per page load (the
  // Google Maps loader) waits for this flag instead of assuming "en".
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(saved)) setLangState(saved);
    setLangReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirForLang(lang);
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "en" ? "ar" : "en";
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: dirForLang(lang),
        dict: DICTS[lang],
        langReady,
        toggleLang,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
