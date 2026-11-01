"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Findings } from "@/components/Findings";
import { Icon } from "@/components/Icons";
import { siteFacts } from "@/components/TripSites";
import { useUnits } from "@/components/Units";
import { api } from "@/components/useLive";
import { formatDate, formatDateRange, formatNumber, formatTripWhen } from "@/lib/format";
import { LOCALE, type Lang, type T } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";
import { useLang, useT } from "@/lib/i18n/useLang";
import { REFRESHER_DAYS } from "@/lib/prep";
import type { TripSite } from "@/lib/trip";
import type { LoggedDiveLink, TripCardView, TripView } from "@/lib/tripViews";

/**
 * A trip's preparation, shared by the web app and the phone app. `edit` (the web app) adds what changes
 * the trip: picking a card's site and linking the logged dives; without it the phone only shows them.
 */
export interface TripEdit {
  tripId: string;
  onChange: () => void;
}

/** Where and when, how many dive days: the line under the trip's name. */
export function tripLine(data: TripView, t: T, lang: Lang): string {
  const dives = data.dives.reduce((n, d) => n + (d.dives ?? 1), 0);
  return [
    data.destination?.toLowerCase() === data.name.toLowerCase() ? null : data.destination,
    formatDateRange(data.startDate, data.endDate, lang),
    formatTripWhen(data, new Date(), lang).toLowerCase(),
    data.cards ? `${t("tripCard.diveDays", { n: data.diveDays })}, ${t("prep.ui.dives", { n: dives })}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function DiveLink({ dive }: { dive: LoggedDiveLink }) {
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  if (dive.seq === null) return <span className="muted">{t("prep.ui.goneDive")}</span>;
  return (
    <>
      <Link href={`/dives/${dive.id}`}>
        #{dive.seq} · {formatDate(dive.start, true, lang)}
      </Link>{" "}
      <span className="secondary">
        {[dive.site, show("depth", dive.maxDepthM), formatNumber(dive.durationMin, 0, "min", lang), t("prep.ui.score", { score: dive.score ?? "–" })].filter(Boolean).join(" · ")}
      </span>
    </>
  );
}

/** The numbers the preparation stands on, from the dives logged before the card's day. */
function Facts({ card }: { card: TripCardView }) {
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  const { experience: e, gasPlan: g } = card.facts;
  const depth = card.maxDepthM;
  return (
    <div className="tiles">
      <div className="tile">
        <div className="label">{depth ? t("prep.ui.divesTo", { depth: show("depth", Math.max(0, depth - 3), 0) }) : t("prep.ui.divesBefore")}</div>
        <div className="value">{depth ? e.divesNearPlannedDepth : e.dives}</div>
        <div className="note">{t("prep.ui.deepest", { depth: show("depth", e.deepestM) })}</div>
      </div>
      <div className="tile">
        <div className="label">{t("prep.ui.sinceLast")}</div>
        <div className="value">{e.daysSinceLastDive === null ? "–" : t("prep.ui.days", { n: e.daysSinceLastDive })}</div>
        <div className="note">{t("prep.ui.last12", { n: e.divesInLast12Months })}</div>
      </div>
      <div className="tile">
        <div className="label">{t("prep.ui.gasAt", { depth: depth ? show("depth", depth, 0) : t("prep.ui.depth") })}</div>
        <div className="value">{show("flow", g.consumptionAtMaxDepthLMin, 0)}</div>
        <div className="note">{t("prep.ui.yourRmv", { rmv: show("flow", g.rmvLMin) })}</div>
      </div>
      <div className="tile">
        <div className="label">{t("prep.ui.ppo2AtMax")}</div>
        <div className="value">{formatNumber(g.ppo2AtMaxDepth, 2, "bar", lang)}</div>
        <div className="note">
          {g.modM !== null
            ? `MOD ${show("depth", g.modM)}`
            : card.facts.gas?.family === "nitrox" && g.bestNitroxPercent !== null
              ? t("prep.ui.richest", { best: g.bestNitroxPercent })
              : t("prep.ui.mixUnknown")}
        </div>
      </div>
    </div>
  );
}

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
const dayPart = (date: string, part: "month" | "weekday", lang: Lang) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(LOCALE[lang], { [part]: "short", timeZone: "UTC" });

/** The card's verdict as on TripDeck (ready / check), else whether it is prepared at all. */
function CardStatus({ card }: { card: TripCardView }) {
  const t = useT();
  if (card.verdict?.status === "check" || !card.prep)
    return (
      <span className="badge warning">
        {Icon.alert}
        {card.verdict?.status === "check" ? t("prep.ui.check") : t("prep.ui.notPrepared")}
      </span>
    );
  return (
    <span className="badge good">
      {Icon.check}
      {card.verdict?.status === "ready" ? t("prep.ui.ready") : t("prep.ui.prepared")}
    </span>
  );
}

const flightTime = (f: { date: string; time?: string }, lang: Lang) => `${formatDate(f.date, false, lang)}${f.time ? `, ${f.time}` : ""}`;

/** The proposed site a card is about: its depths and distance, and why it suits you, linked to the site below. */
function CardSite({ site }: { site: TripSite }) {
  const { range } = useUnits();
  const t = useT();
  const line = siteFacts(site, (min, max) => range("depth", min, max), t);
  return (
    <div className="card-site">
      <a href={`#site-${site.id}`}>
        <strong>{site.name}</strong>
      </a>
      {line && <span className="muted"> · {line}</span>}
      <p style={{ margin: "0.2rem 0 0" }}>{site.why}</p>
    </div>
  );
}

function DayCard({ card, sites, open, edit }: { card: TripCardView; sites: TripSite[]; open: boolean; edit?: TripEdit }) {
  const t = useT();
  const lang = useLang();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function call(path: string, body: unknown) {
    if (!edit) return;
    setBusy(true);
    setFailure(null);
    try {
      await api(`/api/trips/${edit.tripId}/${path}`, "POST", body);
      edit.onChange();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const link = (diveId: string, linked: boolean) => call("dives", { itemId: card.itemId, diveId, linked });
  const pickSite = (siteId: string) => call("cards", { itemId: card.itemId, siteId: siteId || null });

  const plan = [
    card.site && card.site !== card.title ? card.site : null,
    card.maxDepthM ? t("prep.ui.to", { depth: `${card.maxDepthM} m` }) : null,
    card.gas,
    card.dives && card.dives > 1 ? t("prep.ui.dives", { n: card.dives }) : null,
    card.center,
    card.startTime,
  ].filter(Boolean);
  // The missing RMV is on the trip's "Gas plan" tile once, not on every card.
  const notes = card.facts.gasPlan.rmvLMin === null ? card.notes.filter((n) => n !== t("prep.noRmv")) : card.notes;
  // The verdict's line says it best; without one, the first note.
  const [first, ...more] = card.verdict?.summary ? [card.verdict.summary, ...notes] : notes;
  const { comparable } = card.facts;
  // Without edit, only the dives already linked: the ones logged that day wait for a choice on the PC.
  const thatDay = edit ? card.loggedThatDay : [];

  return (
    <article className="card day-card" id={`card-${card.itemId}`} aria-labelledby={`title-${card.itemId}`}>
      <div className="date-col" aria-hidden="true">
        {card.date ? (
          <>
            <span className="num">{Number(card.date.slice(8, 10))}</span>
            <span>
              {dayPart(card.date, "month", lang)} · {dayPart(card.date, "weekday", lang)}
            </span>
          </>
        ) : (
          <span>{card.day ? t("prep.ui.day", { day: card.day }) : "–"}</span>
        )}
      </div>
      <div className="stack" style={{ gap: "0.4rem", flex: "1 1 auto", minWidth: 0 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
          <h3 id={`title-${card.itemId}`} style={{ margin: 0, fontSize: "1.05rem" }}>
            {card.date && <span className="visually-hidden">{formatDate(card.date, false, lang)}: </span>}
            {card.title}
          </h3>
          <span className="row" style={{ gap: "0.35rem" }}>
            {card.openTodos > 0 && (
              <a className="badge" href="#todos">
                {t("prep.ui.toDo", { n: card.openTodos })}
              </a>
            )}
            <CardStatus card={card} />
          </span>
        </div>
        <span className="secondary" style={{ fontSize: "0.9rem" }}>
          {plan.join(" · ") || t("prep.ui.noPlan")}
        </span>
        {card.siteInfo && <CardSite site={card.siteInfo} />}
        {edit && sites.length > 0 && (
          <label className="card-site-pick">
            <span className="muted">{t("details.site")}</span>
            <select value={card.siteId ?? ""} disabled={busy} onChange={(e) => pickSite(e.target.value)}>
              <option value="">{card.siteId ? t("prep.ui.byName") : t("prep.ui.byNameFound", { name: card.siteInfo ? card.siteInfo.name : t("prep.ui.noneFound") })}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status === "chosen" ? ` (${t("prep.ui.chosen")})` : s.status === "dropped" ? ` (${t("prep.ui.dropped")})` : ""}
                </option>
              ))}
              <option value="none">{t("diveList.noSite")}</option>
            </select>
          </label>
        )}
        {first && <p style={{ margin: 0 }}>{first}</p>}

        <details open={open}>
          <summary>{t("prep.ui.full")}</summary>
          <div className="stack" style={{ marginTop: "0.6rem" }}>
            {card.prep ? (
              <div className="review">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.prep.markdown}</ReactMarkdown>
                <p className="muted">{t("common.savedOn", { date: formatDate(card.prep.savedAt.slice(0, 19), true, lang) })}</p>
              </div>
            ) : (
              <p className="muted">{t("prep.ui.notYet")}</p>
            )}
            <Facts card={card} />
            {more.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {more.map((n) => (
                  <li key={n} className="secondary">
                    {n}
                  </li>
                ))}
              </ul>
            )}
            {comparable.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 0.3rem" }}>{t("prep.ui.closest")}</h4>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  {comparable.slice(0, 3).map((d) => (
                    <li key={d.id}>
                      <DiveLink dive={{ ...d, start: d.date }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>

        {(card.logged.length > 0 || thatDay.length > 0) && (
          <div>
            <h4 style={{ margin: "0.3rem 0" }}>{t("prep.ui.logged")}</h4>
            <ul className="logged">
              {card.logged.map((d) => (
                <li key={d.id}>
                  <span>
                    <span className="severity good" role="img" aria-label={t("prep.ui.linked")}>
                      {Icon.check}
                    </span>{" "}
                    <DiveLink dive={d} />
                  </span>
                  {edit && (
                    <button className="button" disabled={busy} onClick={() => link(d.id, false)}>
                      {t("prep.ui.unlink")}
                    </button>
                  )}
                </li>
              ))}
              {thatDay.map((d) => (
                <li key={d.id}>
                  <span>
                    <DiveLink dive={d} />
                  </span>
                  <button className="button" disabled={busy} onClick={() => link(d.id, true)}>
                    {t("prep.ui.thisWas")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {failure && <div className="error">{failure}</div>}
      </div>
    </article>
  );
}

/** A few checks for the whole trip, from the preparation of its first dive. */
export function BeforeYouGo({ data, edit }: { data: TripView; edit?: boolean }) {
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  const first = data.dives.find((d) => d.date) ?? data.dives[0];
  if (!first) return null;
  const { gasPlan: g } = first.facts;
  const issue = data.recurringIssues[0];
  const { breakBefore: b, flight: f } = data;
  return (
    <section className="tiles" aria-label={t("prep.ui.beforeYouGo")}>
      <div className={`card tile ${b && b.days > REFRESHER_DAYS ? "warn" : ""}`}>
        <div className="label">{t("prep.ui.breakBefore")}</div>
        <div className="value">{b ? t("prep.ui.days", { n: b.days }) : "–"}</div>
        <div className="note">
          {!b
            ? t("prep.ui.noDivesBefore")
            : b.after.kind === "trip"
              ? (({ id, name, date }) =>
                  rich(t("prep.ui.afterTrip", { date: formatDate(date, false, lang) }), { a: () => <Link href={`/trips/${id}`}>{name}</Link> }))(b.after)
              : t("prep.ui.afterDive", { seq: b.after.seq })}
          {b && b.days > REFRESHER_DAYS ? ` · ${t("prep.ui.checkOut")}` : ""}
        </div>
      </div>
      <div className={`card tile ${issue ? "warn" : ""}`}>
        <div className="label">{t("prep.ui.keepsComing")}</div>
        <div className="value" style={{ fontSize: "1.1rem" }}>
          {issue ? issue.title : t("prep.ui.nothing")}
        </div>
        <div className="note">{issue ? t("prep.ui.onDives", { count: issue.dives, n: issue.of }) : t("prep.ui.noRepeat")}</div>
      </div>
      <div className={`card tile ${g.rmvLMin === null ? "warn" : ""}`}>
        <div className="label">{t("prep.ui.gasPlan")}</div>
        <div className="value">{g.rmvLMin === null ? t("prep.ui.noRmv") : show("flow", g.rmvLMin)}</div>
        <div className="note">
          {g.rmvLMin !== null ? t("prep.ui.rmvFrom", { n: g.rmvDives }) : edit ? <Link href="/">{t("prep.ui.addTanks")}</Link> : t("prep.ui.addTanksPc")}
        </div>
      </div>
      <div className={`card tile ${f && f.hours < f.neededHours ? "warn" : ""}`}>
        <div className="label">{t("prep.ui.flying")}</div>
        {f ? (
          <>
            <div className="value">
              {formatNumber(f.hours, 0, "h")}{" "}
              <span className={`severity ${f.hours < f.neededHours ? "warning" : "good"}`} role="img" aria-label={f.hours < f.neededHours ? t("prep.ui.tooShort") : t("prep.ui.enough")}>
                {f.hours < f.neededHours ? Icon.alert : Icon.check}
              </span>
            </div>
            <div className="note">
              {[f.flight.from && f.flight.to ? `${f.flight.from}→${f.flight.to}` : t("prep.ui.flight"), flightTime(f.flight, lang)].join(" ")} ·{" "}
              {t("prep.ui.dan", { h: f.neededHours })}
              {f.timeAssumed ? ` · ${t("prep.ui.timeAssumed")}` : ""}
            </div>
          </>
        ) : (
          <>
            <div className="value">–</div>
            <div className="note">{t("prep.ui.noFlight")}</div>
          </>
        )}
      </div>
      <div className={`card tile ${data.prepared < data.cards || data.toCheck ? "warn" : ""}`}>
        <div className="label">{t("prep.ui.preparedTile")}</div>
        <div className="value">{t("prep.ui.of", { done: data.prepared, n: data.cards })}</div>
        <div className="note">{data.toCheck ? t("tripCard.toCheck", { n: data.toCheck }) : t("prep.ui.diveCards")}</div>
      </div>
    </section>
  );
}

/** The problems that repeat in the dives before the trip. */
export function RecurringIssues({ data }: { data: TripView }) {
  const t = useT();
  if (!data.recurringIssues.length) return null;
  return (
    <section className="card" aria-labelledby="recurring-h">
      <h2 id="recurring-h">{t("prep.ui.recurringTitle")}</h2>
      <Findings findings={data.recurringIssues.map((r) => ({ severity: r.severity, title: r.title, detail: t("prep.ui.recurringDetail", { count: r.dives, n: r.of }) }))} />
    </section>
  );
}

/** The dive cards by date, with the days without diving between them; unscheduled ones last. */
export function DiveDays({ data, edit }: { data: TripView; edit?: TripEdit }) {
  const t = useT();
  if (!data.dives.length) return <div className="notice">{t("prep.ui.noCards")}</div>;
  const dated = data.dives.filter((d) => d.date).sort((a, b) => a.date!.localeCompare(b.date!) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const undated = data.dives.filter((d) => !d.date);
  // Open the first card to check or still to prepare, else the first one.
  const openFirst = (data.dives.find((d) => d.verdict?.status === "check" || !d.prep) ?? dated[0] ?? undated[0])?.itemId;
  return (
    <section className="stack" style={{ gap: "0.75rem" }} aria-labelledby="days-h">
      <h2 id="days-h" style={{ margin: 0 }}>
        {t("prep.ui.diveDays")}
      </h2>
      {dated.map((card, i) => {
        const gap = i > 0 ? daysBetween(dated[i - 1].date!, card.date!) - 1 : 0;
        return (
          <div key={card.itemId} className="stack" style={{ gap: "0.75rem" }}>
            {gap > 0 && (
              <div className="gap-divider">{t("prep.ui.gap", { n: gap })}</div>
            )}
            <DayCard card={card} sites={data.sites} open={card.itemId === openFirst} edit={edit} />
          </div>
        );
      })}
      {undated.length > 0 && (
        <>
          {dated.length > 0 && <div className="gap-divider">{t("prep.ui.notScheduled")}</div>}
          {undated.map((card) => (
            <DayCard key={card.itemId} card={card} sites={data.sites} open={card.itemId === openFirst} edit={edit} />
          ))}
        </>
      )}
    </section>
  );
}
