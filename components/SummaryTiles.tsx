import Link from "next/link";
import { formatDate, formatMinutes } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { LogView } from "@/lib/views";
import { useUnits } from "./Units";

/** Dives, time underwater, the deepest and the latest score. Shared by the web app and the phone app. */
export function SummaryTiles({ log }: { log: Pick<LogView, "dives" | "totals"> }) {
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  const { totals, dives } = log;
  if (!dives.length) return null;
  const latest = dives[dives.length - 1];
  const deepest = dives.reduce((a, b) => (b.maxDepthM > a.maxDepthM ? b : a));
  return (
    <section className="tiles" aria-label={t("tiles.summary")}>
      <div className="card tile">
        <div className="label">{t("tiles.dives")}</div>
        <div className="value">{totals.dives}</div>
        <div className="note">{dives[0].start ? t("tiles.since", { date: formatDate(dives[0].start, false, lang) }) : ""}</div>
      </div>
      <div className="card tile">
        <div className="label">{t("tiles.time")}</div>
        <div className="value">{formatMinutes(totals.minutes, lang)}</div>
        <div className="note">{t("tiles.average", { time: formatMinutes(totals.minutes / totals.dives, lang) })}</div>
      </div>
      <div className="card tile">
        <div className="label">{t("tiles.deepest")}</div>
        <div className="value">{show("depth", totals.deepestM)}</div>
        <div className="note">
          <Link href={`/dives/${deepest.id}`}>{t("tiles.dive", { seq: deepest.seq })}</Link>
        </div>
      </div>
      <div className="card tile">
        <div className="label">{t("tiles.latestScore")}</div>
        <div className="value">{totals.latestScore ?? "–"}</div>
        <div className="note">
          <Link href={`/dives/${latest.id}`}>{t("tiles.dive", { seq: latest.seq })} ›</Link>
        </div>
      </div>
    </section>
  );
}
