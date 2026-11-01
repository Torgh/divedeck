"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LOCALE, type Lang, translate } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";
import { useLang } from "@/lib/i18n/useLang";

/** Set by the service worker on a kept copy (public/sw.js). */
const SAVED_HEADER = "x-divedeck-saved";

let savedAt: string | null = null;
const listeners = new Set<() => void>();

/** Called with each answer the live data gets: a kept copy turns the notice on, a fresh one off. */
export function noteAnswer(res: Response) {
  const saved = res.headers.get(SAVED_HEADER);
  if (saved === savedAt) return;
  savedAt = saved;
  for (const l of listeners) l();
}

/** When the copy on screen was kept, or null while the log can be reached. */
export function showingKeptCopy(): string | null {
  return savedAt;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The kept copy's time while one is on screen, for the parts of the page that say so. */
export function useKeptCopy(): string | null {
  return useSyncExternalStore(subscribe, showingKeptCopy, () => null);
}

function when(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(LOCALE[lang], today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Installs the service worker and says when the page shows a kept copy because the log can't be reached. */
export function Offline() {
  const saved = useKeptCopy();
  const lang = useLang();
  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  if (!saved) return null;
  return (
    <div className="notice offline" role="status">
      {rich(translate(lang, "offline.notice", { when: when(saved, lang) }), { b: (s) => <strong>{s}</strong> })}
    </div>
  );
}
