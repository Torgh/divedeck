"use client";

import { LANG_NAME, LANGS } from "@/lib/i18n";
import { setLang, useLang, useT } from "@/lib/i18n/useLang";

/** English, Polish or Spanish, saved in this browser (or phone). Shared by the web app and the phone app. */
export function LanguagePicker() {
  const lang = useLang();
  const t = useT();
  return (
    <div className="card stack">
      <h2>{t("language.title")}</h2>
      <div className="segmented" role="radiogroup" aria-label={t("language.title")} style={{ alignSelf: "start" }}>
        {LANGS.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={lang === l} lang={l} onClick={() => setLang(l)}>
            {LANG_NAME[l]}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t("language.note")}
      </p>
    </div>
  );
}
