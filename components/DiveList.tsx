import Link from "next/link";
import { useState } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import type { Key, Lang } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { DiveRow, LogView } from "@/lib/views";
import { StatusBadge } from "./Findings";
import { Icon } from "./Icons";
import { Sparkline } from "./Sparkline";
import { useUnits } from "./Units";

const FILTERS: { id: string; label: Key; keep: (d: DiveRow, missing: Set<string>) => boolean }[] = [
  { id: "all", label: "diveList.all", keep: () => true },
  { id: "watch", label: "diveList.watch", keep: (d) => d.worstSeverity === "warning" || d.worstSeverity === "critical" },
  { id: "debrief", label: "diveList.noDebrief", keep: (d) => !d.hasReview },
  { id: "missing", label: "diveList.missing", keep: (d, missing) => missing.has(d.id) },
];

/** Matches the words typed against the dive's number, date, site and gas. */
function matches(d: DiveRow, query: string, lang: Lang) {
  const text = `#${d.seq} ${formatDate(d.start, true, lang)} ${d.site ?? ""} ${d.gases.join(" ")}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

/** The dives, newest first, with a search and filters. Shared by the web app and the phone app. */
export function DiveList({ log }: { log: Pick<LogView, "dives" | "todos"> }) {
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  // Dives missing a detail other than the debrief (tank size, gas, site).
  const missing = new Set(log.todos.filter((t) => t.kind !== "review").flatMap((t) => t.dives));
  const keep = FILTERS.find((f) => f.id === filter)!.keep;
  const dives = [...log.dives].reverse().filter((d) => keep(d, missing) && matches(d, query, lang));

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="visually-hidden">{t("diveList.search")}</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("diveList.searchPlaceholder")} />
        </label>
        <div className="chips" role="group" aria-label={t("diveList.show")}>
          {FILTERS.map((f) => {
            const count = log.dives.filter((d) => f.keep(d, missing)).length;
            return (
              <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {t(f.label)} <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {dives.length ? (
        <ul className="dive-list">
          {dives.map((d) => (
            <li key={d.id}>
              <Link href={`/dives/${d.id}`} className="card dive-row">
                <span className="seq">#{d.seq}</span>
                <Sparkline depths={d.sparkline} />
                <span className="main">
                  <strong>{d.site || <span className="muted">{t("diveList.noSite")}</span>}</strong>
                  <span className="secondary">
                    {[formatDate(d.start, true, lang), show("depth", d.maxDepthM), formatNumber(d.durationMin, 0, "min", lang), d.gases.join(", ") || t("diveList.gasUnknown")].join(" · ")}
                  </span>
                </span>
                <span className="side">
                  <StatusBadge severity={d.worstSeverity} />
                  {d.hasReview && (
                    <span className="badge good" title={t("diveList.debriefed")}>
                      {Icon.check}
                      {t("diveList.debrief")}
                    </span>
                  )}
                  <span className="score" aria-label={t("diveList.score", { score: d.score })}>
                    {d.score}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("diveList.noMatch")}</p>
      )}
    </>
  );
}
