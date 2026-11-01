"use client";

import Link from "next/link";
import { useState } from "react";
import { Findings } from "@/components/Findings";
import { GetStarted } from "@/components/GetStarted";
import { Icon } from "@/components/Icons";
import { TripCard } from "@/components/TripCard";
import { LineChart } from "@/components/LineChart";
import { SummaryTiles } from "@/components/SummaryTiles";
import { api, useLive } from "@/components/useLive";
import { useUnits } from "@/components/Units";
import { useSettings } from "@/components/useSettings";
import type { Quantity } from "@/lib/measure";
import { formatNumber } from "@/lib/format";
import type { Key } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { TodoKind } from "@/lib/record";
import type { TripRow } from "@/lib/tripViews";
import type { LogView, ProgressSeries } from "@/lib/views";
import { Command } from "@/components/Command";

type Data = LogView & { version: string; dataFolder: string };
type Todo = Data["todos"][number];

const UNIT: Record<string, string> = { rmvLMin: "L/min", maxAscentRateMMin: "m/min", safetyStopS: "s", score: "" };
/** The metrics shown in the diver's units; the others (seconds, the score) are the same everywhere. */
const QUANTITY: Partial<Record<string, Quantity>> = { rmvLMin: "flow", maxAscentRateMMin: "speed" };

/** A progress series in the diver's units: its values, a value, its unit and its title. */
function useSeriesUnits(p: ProgressSeries) {
  const { value, unit } = useUnits();
  const t = useT();
  const quantity = QUANTITY[p.metric];
  const to = (v: number) => (quantity ? value(quantity, v) : v);
  const shown = quantity ? unit(quantity) : UNIT[p.metric];
  const label = t(`progress.metric.${p.metric}`);
  const title = quantity ? label.replace(UNIT[p.metric], shown) : label;
  return { to, unit: shown, title };
}

/** The trips under way or coming, each with how far its preparation is. */
function UpcomingTrips() {
  const { data } = useLive<{ version: string; trips: TripRow[] }>("/api/trips");
  const t = useT();
  const trips = data?.trips.filter((trip) => trip.when === "now" || trip.when === "upcoming") ?? [];
  if (!trips.length) return null;
  return (
    <section className="trip-cards" aria-label={t("dash.upcoming")}>
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </section>
  );
}

const TODO_COPY: Record<TodoKind, { title: Key; why: Key }> = {
  "tank-volume": { title: "dash.todo.tank", why: "dash.todo.tankWhy" },
  gas: { title: "dash.todo.gas", why: "dash.todo.gasWhy" },
  site: { title: "dash.todo.site", why: "dash.todo.siteWhy" },
  review: { title: "dash.todo.review", why: "dash.todo.reviewWhy" },
};

function DiveLinks({ todo }: { todo: Todo }) {
  const t = useT();
  return (
    <span className="why">
      {todo.seqs.slice(0, 8).map((seq, i) => (
        <span key={seq}>
          {i ? ", " : ""}
          <Link href={`/dives/${todo.dives[i]}`}>#{seq}</Link>
        </span>
      ))}
      {todo.seqs.length > 8 ? ` ${t("dash.andMore", { n: todo.seqs.length - 8 })}` : ""}
    </span>
  );
}

/** One value for every dive that misses it: most divers use the same tank and gas all along. */
/** What a "Save for N dives" just changed, so it can be undone. */
interface BulkSave {
  field: "tankVolumeL" | "gas";
  dives: string[];
  seqs: number[];
  text: string;
}

function SaveForAll({
  todo,
  field,
  label,
  placeholder,
  onSaved,
}: {
  todo: Todo;
  field: BulkSave["field"];
  label: string;
  placeholder: string;
  onSaved: (done: BulkSave) => void;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const n = todo.dives.length;

  async function save() {
    const raw = value.trim().replace(",", ".");
    if (field === "tankVolumeL" && !(Number(raw) > 0)) {
      setFailure(t("dash.badTank"));
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      for (const id of todo.dives) await api(`/api/dives/${id}`, "PATCH", { [field]: field === "tankVolumeL" ? Number(raw) : raw });
      setValue("");
      onSaved({ field, dives: todo.dives, seqs: todo.seqs, text: field === "tankVolumeL" ? `${Number(raw)} L` : raw });
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label>
        {label}
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} inputMode={field === "tankVolumeL" ? "decimal" : "text"} />
      </label>
      <button className="button primary" type="button" disabled={busy || !value.trim()} onClick={save}>
        {busy ? t("common.saving") : n === 1 ? t("dash.saveOne") : t("dash.saveFor", { n })}
      </button>
      {failure && (
        <span role="alert" style={{ color: "var(--critical)", flexBasis: "100%" }}>
          {failure}
        </span>
      )}
    </>
  );
}

/** A debrief here with an API key; with a subscription, the command to run in Claude Code or Codex. */
function DebriefAction({ todo, onSaved }: { todo: Todo; onSaved: () => void }) {
  const { settings } = useSettings();
  const t = useT();
  const lang = useLang();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const provider = settings?.providers.find((p) => p.id === settings.provider);
  if (!provider) return null;
  const last = todo.dives.length - 1;
  if (!provider.usesApi || !provider.key) {
    return (
      <span className="muted">
        {t("dash.inApp", { app: provider.app ?? "" })} <Command text={`/mcp__divedeck__dive-review ${todo.seqs[last]}`} />
      </span>
    );
  }
  async function ask() {
    setBusy(true);
    setFailure(null);
    try {
      await api("/api/coach/review", "POST", { diveId: todo.dives[last], lang });
      onSaved();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="button" type="button" disabled={busy} onClick={ask}>
        {busy ? t("dash.debriefing") : t("dash.debriefOf", { seq: todo.seqs[last] })}
      </button>
      {failure && (
        <span role="alert" style={{ color: "var(--critical)", flexBasis: "100%" }}>
          {failure}
        </span>
      )}
    </>
  );
}

/**
 * "Saved 12 L for #1, #2, #3 · Undo": the dives had no value before (that is why they were listed),
 * so undoing removes it again. Stays until dismissed or undone, also when the to-do row is gone.
 */
function UndoBar({ done, onUndone, onDismiss }: { done: BulkSave; onUndone: () => void; onDismiss: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function undo() {
    setBusy(true);
    setFailure(null);
    try {
      for (const id of done.dives) await api(`/api/dives/${id}`, "PATCH", { [done.field]: null });
      onUndone();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notice row" role="status" style={{ justifyContent: "space-between" }}>
      <span>
        {rich(t(done.field === "gas" ? "dash.savedGas" : "dash.saved", { value: done.text, dives: done.seqs.map((s) => `#${s}`).join(", ") }), {
          b: (s) => <strong>{s}</strong>,
        })}
      </span>
      <span className="row" style={{ gap: "0.5rem" }}>
        <button className="button" type="button" disabled={busy} onClick={undo}>
          {busy ? t("dash.undoing") : t("sites.undo")}
        </button>
        <button className="button" type="button" disabled={busy} onClick={onDismiss} aria-label={t("dash.dismiss")}>
          ×
        </button>
      </span>
      {failure && (
        <span role="alert" style={{ color: "var(--critical)", flexBasis: "100%" }}>
          {failure}
        </span>
      )}
    </div>
  );
}

function SortOut({ todos, onSaved, onBulkSaved }: { todos: Todo[]; onSaved: () => void; onBulkSaved: (done: BulkSave) => void }) {
  const t = useT();
  return (
    <section className="card" aria-labelledby="todo-h">
      <h2 id="todo-h">{t("todos.title")}</h2>
      {todos.map((todo) => (
        <div key={todo.kind} className="todo-row">
          <div className="what">
            <strong>{t(TODO_COPY[todo.kind].title)}</strong>
            <span className="why">{t(TODO_COPY[todo.kind].why)}</span>
            <DiveLinks todo={todo} />
          </div>
          {todo.kind === "tank-volume" && <SaveForAll todo={todo} field="tankVolumeL" label={t("dash.tankL")} placeholder="12" onSaved={onBulkSaved} />}
          {todo.kind === "gas" && <SaveForAll todo={todo} field="gas" label={t("details.gas")} placeholder="air, EAN32" onSaved={onBulkSaved} />}
          {todo.kind === "site" && (
            <Link className="button" href={`/dives/${todo.dives[0]}#details`}>
              {t("dash.fillIn", { seq: todo.seqs[0] })}
            </Link>
          )}
          {todo.kind === "review" && <DebriefAction todo={todo} onSaved={onSaved} />}
        </div>
      ))}
      <p className="muted" style={{ marginBottom: 0 }}>
        {t("dash.orAsk")} <Command text="/mcp__divedeck__sort-out" />
      </p>
    </section>
  );
}

/** "worsening · 4.2 → 9.6 m/min", with an arrow for the direction and a colour for good or bad. */
function TrendNote({ p }: { p: ProgressSeries }) {
  const { to, unit } = useSeriesUnits(p);
  const t = useT();
  const lang = useLang();
  const digits = unit.startsWith("cu ft") ? 2 : 1;
  if (!p.trend) return <span className="trend">{t("dash.trendAfter")}</span>;
  const { verdict, earlyAvg, recentAvg } = p.trend;
  if (verdict === "stable") return <span className="trend">{t("dash.verdict.stable")}</span>;
  const tone = verdict === "improving" ? "good" : verdict === "worsening" ? "warning" : "";
  return (
    <span className={`trend ${tone}`}>
      {recentAvg > earlyAvg ? Icon.up : recentAvg < earlyAvg ? Icon.down : null}
      {t(`dash.verdict.${verdict}`)} · {formatNumber(to(earlyAvg), digits, "", lang)} → {formatNumber(to(recentAvg), digits, unit, lang)}
    </span>
  );
}

function ProgressChart({ p }: { p: ProgressSeries }) {
  const { to, unit, title } = useSeriesUnits(p);
  const t = useT();
  const lang = useLang();
  const x = p.points.map((pt) => pt.seq);
  const fit = p.fit;
  // The score can't leave 0–100, so neither does its trend line (nor the axis with it).
  const clamp = (v: number) => (p.metric === "score" ? Math.min(100, Math.max(0, v)) : v);
  const fitAt = (seq: number) => (fit ? to(clamp(fit[0].value + ((fit[1].value - fit[0].value) * (seq - fit[0].seq)) / (fit[1].seq - fit[0].seq || 1))) : null);
  const limit = to(10);
  return (
    <div className="card">
      <div className="chart-head">
        <h3>{title}</h3>
        <TrendNote p={p} />
      </div>
      <LineChart
        title={title}
        x={x}
        xUnit={t("dash.dive")}
        formatX={(v) => `#${Math.round(v)}`}
        formatY={(v) => formatNumber(v, unit.startsWith("cu ft") ? 2 : 1, unit, lang)}
        height={180}
        includeY={p.metric === "score" ? [0, 100] : [0]}
        series={[
          { key: "value", label: title, color: "var(--series-1)", values: p.points.map((pt) => to(pt.value)), dots: true },
          ...(fit ? [{ key: "trend", label: t("dash.trend"), color: "var(--series-muted)", values: x.map(fitAt), muted: true }] : []),
        ]}
        xTicks={x.filter((_, i) => i % Math.ceil(x.length / 8) === 0 || i === x.length - 1)}
        refLines={p.metric === "maxAscentRateMMin" ? [{ y: limit, label: t("dash.limit", { value: `${formatNumber(limit, 0, "", lang)} ${unit}` }) }] : []}
      />
      <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
        {p.better !== "neutral" ? t(p.better === "lower" ? "dash.lower" : "dash.higher") : ""}
      </p>
    </div>
  );
}

function Progress({ data }: { data: Data }) {
  const t = useT();
  const charted = data.progress.filter((p) => p.points.length >= 2);
  const waiting = data.progress.filter((p) => p.points.length < 2);
  const label = (p: ProgressSeries) => t(`progress.metric.${p.metric}`);
  // The trends of the charted metrics are on their charts; the rest (recurring issues…) stays a list.
  const labels = charted.map((p) => `${label(p)}:`);
  const other = data.insights.filter((f) => !labels.some((l) => f.title.startsWith(l)));
  return (
    <section className="stack" aria-labelledby="prog-h">
      <div className="chart-head">
        <h2 id="prog-h" style={{ margin: 0 }}>
          {t("dash.progress")}
        </h2>
        {waiting.length > 0 && (
          <span className="muted">
            {waiting
              .map((p) =>
                p.metric === "rmvLMin" && p.points.length === 0 ? t("dash.rmvWaits", { metric: label(p) }) : t("dash.secondDive", { metric: label(p) }),
              )
              .join(" · ")}
          </span>
        )}
      </div>
      {other.length > 0 && (
        <div className="card">
          <Findings findings={other} />
        </div>
      )}
      <div className="grid cols-2">
        {charted.map((p) => (
          <ProgressChart key={p.metric} p={p} />
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLive<Data>("/api/dives");
  const [lastSave, setLastSave] = useState<BulkSave | null>(null);
  const t = useT();
  if (error && !data) return <div className="error">{t("log.loadFailed", { error })}</div>;
  if (!data) return <p className="muted">{t("log.loading")}</p>;
  const head = (
    <div className="page-head">
      <h1>{t("nav.dashboard")}</h1>
      <Link className="button primary" href="/import">
        {t("log.import")}
      </Link>
    </div>
  );
  if (!data.dives.length) {
    return (
      <div className="stack">
        {head}
        <GetStarted dives={0} onImported={reload} />
        <UpcomingTrips />
        <div className="notice">
          {rich(t("dash.empty"), { a: (s) => <Link href="/import">{s}</Link> })}
        </div>
        <p className="muted">{t("dash.dataFolder", { folder: data.dataFolder })}</p>
      </div>
    );
  }
  const { dives } = data;
  return (
    <div className={`stack ${loading ? "loading" : ""}`} style={{ gap: "1.25rem" }}>
      {head}
      <GetStarted dives={dives.length} onImported={reload} />
      <UpcomingTrips />
      <SummaryTiles log={data} />

      {lastSave && (
        <UndoBar
          done={lastSave}
          onDismiss={() => setLastSave(null)}
          onUndone={() => {
            setLastSave(null);
            void reload();
          }}
        />
      )}
      {data.todos.length > 0 && (
        <SortOut
          todos={data.todos}
          onSaved={reload}
          onBulkSaved={(done) => {
            setLastSave(done);
            void reload();
          }}
        />
      )}

      <Progress data={data} />
    </div>
  );
}
