import Link from "next/link";
import { formatDateRange, formatTripWhen } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { TripRow } from "@/lib/tripViews";
import { Icon } from "./Icons";
import { useUnits } from "./Units";

/**
 * A trip as a card: when, where, and how far its preparation is (or, once past, the dives logged).
 * Opens the trip.
 */
export function TripCard({ trip: t }: { trip: TripRow }) {
  const { range } = useUnits();
  const tr = useT();
  const lang = useLang();
  const left = t.cards - t.prepared;
  const depth = (s: TripRow["chosenSites"][number]) => range("depth", s.minDepthM, s.maxDepthM);
  const past = t.when === "past";
  return (
    <Link href={`/trips/${t.id}`} className="card trip-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">{formatTripWhen(t, new Date(), lang)}</span>
        {past ? (
          <span className="badge">{tr("tripCard.logged", { n: t.loggedDives })}</span>
        ) : (
          t.cards > 0 &&
          (t.toCheck > 0 || left > 0 ? (
            <span className="badge warning">
              {Icon.alert}
              {[t.toCheck ? tr("tripCard.toCheck", { n: t.toCheck }) : null, left ? tr("tripCard.toPrepare", { n: left }) : null].filter(Boolean).join(" · ")}
            </span>
          ) : (
            <span className="badge good">
              {Icon.check}
              {tr("tripCard.allPrepared")}
            </span>
          ))
        )}
      </div>
      <h2>{t.name}</h2>
      <span className="secondary">
        {[
          formatDateRange(t.startDate, t.endDate, lang),
          t.destination?.toLowerCase() === t.name.toLowerCase() ? null : t.destination,
          t.diveDays ? tr("tripCard.diveDays", { n: t.diveDays }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {!past && t.openTodos > 0 && (
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {tr("tripCard.openTodos", { n: t.openTodos })}
        </span>
      )}
      {t.chosenSites.length > 0 && (
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {tr("tripCard.sites", { sites: t.chosenSites.map((s) => [s.name, depth(s)].filter(Boolean).join(" ")).join(" · ") })}
        </span>
      )}
      {!past && t.cards > 0 && (
        <div className="stack" style={{ gap: "0.35rem" }}>
          <div className="meter" role="img" aria-label={tr("tripCard.prepared", { done: t.prepared, n: t.cards })}>
            <span style={{ width: `${(100 * t.prepared) / t.cards}%` }} />
          </div>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {tr("tripCard.prepared", { done: t.prepared, n: t.cards })}
          </span>
        </div>
      )}
    </Link>
  );
}
