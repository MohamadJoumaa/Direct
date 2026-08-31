"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { OrderType } from "@direct/shared";
import { en, type Dictionary } from "./en";
import { ar } from "./ar";

export type Lang = "en" | "ar";

const STORAGE_KEY = "direct-lang";
const DICTS: Record<Lang, Dictionary> = { en, ar };

type I18nContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/** Replace {placeholders} in a dictionary string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function lookup(dict: Dictionary, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function orderTypeLabel(type: OrderType, dict: Dictionary): string {
  switch (type) {
    case "normal":
      return dict.order.typeFast;
    case "long_distance":
      return dict.order.typeLong;
    case "trusted":
      return dict.order.typeTrusted;
    case "private":
      return dict.order.typePrivate;
    case "owner":
      return dict.order.typeOwner;
    default:
      return type;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "en" ? "ar" : "en";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const raw = lookup(DICTS[lang], path) ?? path;
      return vars ? fmt(raw, vars) : raw;
    },
    [lang],
  );

  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: lang === "ar" ? "rtl" : "ltr",
        dict: DICTS[lang],
        setLang,
        toggleLang,
        t,
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
