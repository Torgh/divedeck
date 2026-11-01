import { useMemo, useState } from "react";
import { headline, MetricCards, ScoreRing } from "@/components/DiveSummary";
import { DiveList } from "@/components/DiveList";
import { FindingBadge, Findings } from "@/components/Findings";
import { FoldedMarkdown } from "@/components/FoldedMarkdown";
import { BalanceCard } from "@/components/gear/BalanceCard";
import { GearCard } from "@/components/gear/GearCard";
import { ResultCard } from "@/components/gear/ResultCard";
import { GROUPS, type TankChoice } from "@/components/gear/shared";
import { YouStrip } from "@/components/gear/YouStrip";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ProfileCharts } from "@/components/ProfileCharts";
import { SummaryTiles } from "@/components/SummaryTiles";
import { BeforeYouGo, DiveDays, RecurringIssues, tripLine } from "@/components/TripPrep";
import { TripSites } from "@/components/TripSites";
import { TripTodos } from "@/components/TripTodos";
import { TripCard } from "@/components/TripCard";
import { useUnits } from "@/components/Units";
import type { DiveDeckExport } from "@/lib/exportFile";
import { formatDate } from "@/lib/format";
import { rich } from "@/lib/i18n/rich";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { Kit, Water } from "@/lib/kit";
import type { DiveRecord } from "@/lib/record";
import type { TripPlan } from "@/lib/trip";
import { type TripRow, tripView } from "@/lib/tripViews";
import { diveView, type LogView } from "@/lib/views";
import { estimateWeighting } from "@/lib/weighting";

/** "2026-10-26T21:31:00" in the phone's time zone, for formatDate (the export's time is UTC). */
export function localTime(iso: string): string | null {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return null;
  return new Date(t.getTime() - t.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

/** Where the file comes from, said the same way on every screen that asks for it. */
function How() {
  const t = useT();
  return <>{rich(t("phone.how"), { b: (s) => <strong>{s}</strong> })}</>;
}

export function Welcome({ onImport }: { onImport: () => void }) {
  const t = useT();
  return (
    <div className="stack welcome" style={{ gap: "1.25rem" }}>
      <img src="./icon.svg" alt="" width={72} height={72} />
      <h1>{t("phone.welcome")}</h1>
      <p className="secondary">
        {t("phone.welcomeText")} <How />
      </p>
      <button type="button" className="button primary" onClick={onImport}>
        {t("phone.importFile")}
      </button>
      <LanguagePicker />
    </div>
  );
}

/** Dives imported on the phone that the PC doesn't have yet, with the way to send them. */
function OnPhoneNotice({ count }: { count: number }) {
  const t = useT();
  if (!count) return null;
  return <div className="notice">{rich(t("phone.onlyHere", { n: count }), { a: (s) => <a href="#/file">{s}</a> })}</div>;
}

export function Home({ log, next, onPhone }: { log: LogView; next: TripRow | null; onPhone: number }) {
  const t = useT();
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.dashboard")}</h1>
      </div>
      <OnPhoneNotice count={onPhone} />
      {next && <TripCard trip={next} />}
      {log.dives.length ? <SummaryTiles log={log} /> : <div className="notice">{t("phone.noDives")}</div>}
    </div>
  );
}

export function LogScreen({ log }: { log: LogView }) {
  const t = useT();
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.log")}</h1>
      </div>
      {log.dives.length ? <DiveList log={log} /> : <div className="notice">{t("phone.noDives")}</div>}
    </div>
  );
}

/** One dive, as on the PC, without the forms: the phone only shows the log. */
export function DiveScreen({ records, id, onPhone }: { records: DiveRecord[]; id: string; onPhone: boolean }) {
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<"debrief" | "findings">("debrief");
  const data = diveView(records, id, lang);
  if (!data) return <div className="notice">{rich(t("phone.noDive"), { a: (s) => <a href="#/dives">{s}</a> })}</div>;
  const { dive, metrics, details } = data;
  const site = [dive.site, dive.location].filter(Boolean).join(", ");
  const facts: [string, string | undefined][] = [
    [t("phone.site"), site || undefined],
    [t("details.buddy"), details.buddy],
    [t("gear.kind.tank"), data.tanks[0]?.volumeL ? show("volume", data.tanks[0].volumeL) : undefined],
    [t("phone.lead"), details.ballastKg !== undefined ? `${details.ballastKg} kg` : undefined],
    [t("phone.weighting"), details.weighting && t(`feel.${details.weighting}`)],
    [t("details.notes"), details.notes],
  ];
  const known = facts.filter((f): f is [string, string] => !!f[1]);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="dive-head">
        <div>
          <a className="back" href="#/dives">
            ‹ {t("nav.log")}
          </a>
          <h1>{t("dive.title", { seq: data.seq })}</h1>
          <div className="secondary">{[formatDate(dive.start, true, lang), metrics.gases.join(", ") || t("diveList.gasUnknown"), site || null].filter(Boolean).join(" · ")}</div>
        </div>
        <nav className="row" aria-label={t("dive.other")}>
          {data.prevId && (
            <a className="button" href={`#/dives/${data.prevId}`} aria-label={t("dive.previous", { seq: data.seq - 1 })}>
              ‹ #{data.seq - 1}
            </a>
          )}
          {data.nextId && (
            <a className="button" href={`#/dives/${data.nextId}`} aria-label={t("dive.next", { seq: data.seq + 1 })}>
              #{data.seq + 1} ›
            </a>
          )}
        </nav>
      </div>

      {onPhone && (
        <div className="notice">
          {rich(t("phone.importedHere"), { a: (s) => <a href="#/file">{s}</a> })}
        </div>
      )}

      <section className="card verdict" aria-label={t("dive.score")}>
        <ScoreRing score={metrics.score} />
        <div style={{ flex: "1 1 320px" }}>
          <p className="headline">{headline(data.findings, t)}</p>
          <div className="row" style={{ gap: "0.5rem" }}>
            {data.findings.map((f, i) => (
              <FindingBadge key={`${f.title}${i}`} finding={f} />
            ))}
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="profile-h">
        <h2 id="profile-h">{t("summary.profile")}</h2>
        <ProfileCharts view={data} />
      </section>

      <MetricCards data={data} />

      <section className="card" aria-label={t("dive.debriefAndFindings")}>
        <div className="tabs" role="tablist">
          {(
            [
              { id: "debrief", label: t("diveList.debrief") },
              { id: "findings", label: t("dive.findings", { n: data.findings.length }) },
            ] as const
          ).map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "findings" ? (
            <Findings findings={data.findings} />
          ) : data.review ? (
            <div className="review">
              <FoldedMarkdown key={data.review.savedAt} markdown={data.review.markdown} />
              <p className="muted">{t("common.savedOn", { date: formatDate(data.review.savedAt.slice(0, 19), true, lang) })}</p>
            </div>
          ) : (
            <p className="muted">{onPhone ? t("phone.noDebriefHere") : t("phone.noDebrief")}</p>
          )}
        </div>
      </section>

      {known.length > 0 && (
        <section className="card metric-card" aria-labelledby="details-h">
          <h3 id="details-h">{t("dive.details")}</h3>
          {known.map(([label, value]) => (
            <div key={label} className="kv">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

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

export function TripsScreen({ trips }: { trips: TripRow[] }) {
  const t = useT();
  const of = (...when: TripRow["when"][]) => trips.filter((trip) => when.includes(trip.when));
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.trips")}</h1>
      </div>
      {!trips.length ? (
        <div className="notice">{t("phone.noTrips")}</div>
      ) : (
        <>
          <Group title={t("trips.comingUp")} trips={of("now", "upcoming")} />
          <Group title={t("format.noDatesYet")} trips={of("undated")} />
          <Group title={t("trips.past")} trips={of("past")} />
        </>
      )}
    </div>
  );
}

/** One trip's preparation, as on the PC; the to-dos, sites and logged dives are changed there. */
export function TripScreen({ plans, records, id, now }: { plans: TripPlan[]; records: DiveRecord[]; id: string; now: Date }) {
  const t = useT();
  const lang = useLang();
  const data = tripView(plans, records, id, now, lang);
  if (!data) return <div className="notice">{rich(t("phone.noTrip"), { a: (s) => <a href="#/trips">{s}</a> })}</div>;
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="dive-head">
        <div>
          <a className="back" href="#/trips">
            ‹ {t("nav.trips")}
          </a>
          <h1>{data.name}</h1>
          <div className="secondary">{tripLine(data, t, lang)}</div>
        </div>
      </div>

      <TripTodos todos={data.todos} cards={data.dives.map((d) => ({ itemId: d.itemId, title: d.date ? `${d.title} (${formatDate(d.date, false, lang)})` : d.title }))} />

      <BeforeYouGo data={data} />

      <RecurringIssues data={data} />

      <section className="card review" aria-labelledby="notes-h">
        <h2 id="notes-h">{t("trip.notes")}</h2>
        {data.summary ? <FoldedMarkdown markdown={data.summary.markdown} /> : <p className="muted">{t("phone.noNotes")}</p>}
      </section>

      <TripSites trip={data.name} shop={data.shop} sites={data.sites} notes={data.siteNotes} />

      <DiveDays data={data} />
    </div>
  );
}

/** Your sets and the lead each needs, worked out on the phone as on the PC; the gear is changed there. */
export function GearScreen({ kit, records }: { kit: Kit; records: DiveRecord[] }) {
  const t = useT();
  const lang = useLang();
  const [setId, setSetId] = useState<string | null>(null);
  const [waterChoice, setWaterChoice] = useState<Water | null>(null);
  const [tank, setTank] = useState<TankChoice>("own");
  const set = kit.sets.find((s) => s.id === setId) ?? kit.sets[0] ?? null;
  const water = waterChoice ?? set?.water ?? "salt";
  const estimate = useMemo(
    () => (set ? estimateWeighting(kit, records, set, water, undefined, tank === "own" ? null : tank, lang) : undefined),
    [kit, records, set, water, tank, lang],
  );
  const ownTank = set ? kit.items.find((i) => i.kind === "tank" && set.itemIds.includes(i.id)) : undefined;
  const hasTank = tank !== "own" || !!ownTank;
  const inSet = set ? kit.items.filter((i) => set.itemIds.includes(i.id)) : kit.items;
  const parts = estimate?.parts ?? [];

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.gear")}</h1>
      </div>

      <YouStrip kit={kit} you={parts.find((p) => !p.itemId)} water={water} />

      {kit.sets.length > 1 && (
        <div className="tabs set-tabs" role="tablist" aria-label={t("gearPage.sets")}>
          {kit.sets.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === set?.id}
              onClick={() => {
                setSetId(s.id);
                setWaterChoice(null);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {set ? (
        <span className="secondary">
          <strong>{set.name}</strong>
          {[
            set.ballastKg !== undefined ? t("gearPage.usualLead", { kg: set.ballastKg }) : null,
            set.water ? t("gearPage.meantFor", { water: t(`water.long.${set.water}`) }) : null,
            set.notes,
          ]
            .filter(Boolean)
            .map((x) => ` · ${x}`)
            .join("")}
        </span>
      ) : (
        <div className="notice">{t("phone.noSets")}</div>
      )}

      {set && estimate && (
        <div className="balance-grid">
          <ResultCard estimate={estimate} hasTank={hasTank} />
          <BalanceCard estimate={estimate} hasTank={hasTank} water={water} setWater={setWaterChoice} tank={tank} setTank={setTank} ownTank={ownTank} />
        </div>
      )}

      <section className="stack" style={{ gap: "0.75rem" }} aria-labelledby="items-h">
        <h2 id="items-h" style={{ margin: 0 }}>
          {set ? t("items.inSet") : t("items.yours")}
        </h2>
        {!kit.items.length && <p className="muted">{t("phone.noGear")}</p>}
        {GROUPS.map((g) => {
          const items = inSet.filter((i) => g.kinds.includes(i.kind));
          return items.length ? (
            <div key={g.title} className="stack" style={{ gap: "0.5rem" }}>
              <h3 className="group-title">{t(g.title)}</h3>
              <div className="gear-grid">
                {items.map((item) => (
                  <GearCard key={item.id} item={item} part={parts.find((p) => p.itemId === item.id)} />
                ))}
              </div>
            </div>
          ) : null;
        })}
      </section>

      <p className="muted" style={{ margin: 0 }}>
        {t("phone.estimate")}
      </p>
    </div>
  );
}

/** What was imported, getting a newer export, and the dives imported here on their way to the PC. */
export function FileScreen({
  log,
  onPhone,
  onImport,
  onSend,
  onForget,
}: {
  log: DiveDeckExport;
  onPhone: number;
  onImport: () => void;
  onSend: () => void;
  onForget: () => void;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("phone.yourFile")}</h1>
      </div>
      <div className="card stack">
        <p style={{ margin: 0 }}>
          {rich(
            t("phone.exportedOn", {
              date: formatDate(localTime(log.exportedAt), true, lang),
              dives: t("log.count", { n: log.dives.length }),
              trips: t("phone.trips", { n: log.trips.length }),
              units: log.units,
            }),
            { b: (s) => <strong>{s}</strong> },
          )}
        </p>
        <p className="secondary" style={{ margin: 0 }}>
          {t("phone.asThen")} <How />
        </p>
        <div className="row">
          <button type="button" className="button primary" onClick={onImport}>
            {t("phone.importNewer")}
          </button>
          <button type="button" className="button" onClick={onForget}>
            {t("phone.remove")}
          </button>
        </div>
      </div>
      <section className="card stack" aria-labelledby="uddf-h">
        <h2 id="uddf-h" style={{ margin: 0 }}>
          {t("phone.fromComputer")}
        </h2>
        <p className="secondary" style={{ margin: 0 }}>
          {t("phone.fromComputerHelp")}
        </p>
        {onPhone > 0 && <p style={{ margin: 0 }}>{rich(t("phone.onlyOnPhone", { n: onPhone }), { b: (s) => <strong>{s}</strong> })}</p>}
        <div className="row">
          <button type="button" className={`button ${onPhone ? "" : "primary"}`} onClick={onImport}>
            {t("phone.importUddf")}
          </button>
          {onPhone > 0 && (
            <button type="button" className="button primary" onClick={onSend}>
              {t("phone.send")}
            </button>
          )}
        </div>
      </section>
      <LanguagePicker />
    </div>
  );
}
