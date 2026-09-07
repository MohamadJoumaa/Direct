"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, toggleLang } = useI18n();
  return (
    <Button
      variant="ghost"
      className="touch-target rounded-full px-3 font-semibold"
      aria-label={lang === "en" ? "العربية" : "English"}
      onClick={toggleLang}
    >
      <Languages className="size-5" />
      <span className="text-sm">{lang === "en" ? "العربية" : "EN"}</span>
    </Button>
  );
}
