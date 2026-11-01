"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n/useLang";

/** Keeps <html lang> on the app's language, for screen readers and hyphenation; the page renders in English first. */
export function LangAgent() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
