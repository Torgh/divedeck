/** Display helpers shared by the pages (no Python compatibility needed here), in the app's language. */
import { LOCALE, translate, type Lang } from "./i18n";

const dayFormat = (lang: Lang) => new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const utcDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function formatDate(iso: string | null, withTime = true, lang: Lang = "en"): string {
  if (!iso) return translate(lang, "format.undated");
  const [date, time] = iso.split("T");
  const day = dayFormat(lang).format(utcDay(date));
  return withTime && time ? `${day}, ${time.slice(0, 5)}` : day;
}

/** "1 h 05 min" or "42 min". */
export function formatMinutes(minutes: number, lang: Lang = "en"): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? translate(lang, "format.hMin", { h, m: String(m).padStart(2, "0") }) : translate(lang, "format.min", { m });
}

export function formatNumber(value: number | null | undefined, digits = 1, unit = "", lang: Lang = "en"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const text = value.toLocaleString(LOCALE[lang], { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  return unit ? `${text} ${unit}` : text;
}

/** "3 min 20 s". */
export function formatSeconds(seconds: number, lang: Lang = "en"): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? translate(lang, "format.minS", { m, s }) : translate(lang, "format.s", { s });
}

/** "8 – 15 May 2027", "28 Apr – 3 May 2027", "8 May 2027", or "No dates". */
export function formatDateRange(start: string | null, end: string | null, lang: Lang = "en"): string {
  if (!start) return translate(lang, "format.noDates");
  if (!end || end === start) return formatDate(start, false, lang);
  // ICU puts thin spaces around the dash in some languages; plain ones read the same everywhere.
  return dayFormat(lang).formatRange(utcDay(start), utcDay(end)).replace(/[  ]/g, " ");
}

/** When a trip is, from today: "in 12 days", "tomorrow", "under way", "ended 3 days ago". */
export function formatTripWhen(
  trip: { when: "upcoming" | "now" | "past" | "undated"; daysUntil: number | null; endDate: string | null },
  today = new Date(),
  lang: Lang = "en",
): string {
  const t = (key: Parameters<typeof translate>[1], params?: { n: number }) => translate(lang, key, params);
  if (trip.when === "undated" || trip.daysUntil === null) return t("format.noDatesYet");
  if (trip.when === "now") return t("format.underWay");
  if (trip.when === "upcoming") return trip.daysUntil === 1 ? t("format.tomorrow") : t("format.inDays", { n: trip.daysUntil });
  const end = trip.endDate ? Math.round((today.getTime() - Date.parse(`${trip.endDate}T00:00:00Z`)) / 86_400_000) : null;
  return end !== null && end > 0 ? (end === 1 ? t("format.endedYesterday") : t("format.endedDaysAgo", { n: end })) : t("format.ended");
}
