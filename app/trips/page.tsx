"use client";

import { TripCard } from "@/components/TripCard";
import { TripPrepHint } from "@/components/TripPrepHint";
import { useLive } from "@/components/useLive";
import { useT } from "@/lib/i18n/useLang";
import type { TripRow } from "@/lib/tripViews";

type Data = { version: string; trips: TripRow[]; next: TripRow | null };

function Group({ title, trips }: { title: string; trips: TripRow[] }) {
  if (!trips.length) return null;
  return (
    <section className="stack" style={{ gap: "0.75rem" }} aria-label={title}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <div className="trip-cards">
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>
    </section>
  );
}

export default function Trips() {
  const { data, error, loading } = useLive<Data>("/api/trips");
  const t = useT();
  if (error && !data) return <div className="error">{t("trips.loadFailed", { error })}</div>;
  if (!data) return <p className="muted">{t("trips.loading")}</p>;
  const of = (...when: TripRow["when"][]) => data.trips.filter((trip) => when.includes(trip.when));
  return (
    <div className={`stack ${loading ? "loading" : ""}`} style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.trips")}</h1>
      </div>
      {!data.trips.length ? (
        <div className="notice">
          {t("trips.none")}
          <TripPrepHint />
        </div>
      ) : (
        <>
          <Group title={t("trips.comingUp")} trips={of("now", "upcoming")} />
          <Group title={t("format.noDatesYet")} trips={of("undated")} />
          <Group title={t("trips.past")} trips={of("past")} />
          <TripPrepHint />
        </>
      )}
    </div>
  );
}
