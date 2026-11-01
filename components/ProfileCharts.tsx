"use client";

import { useState, useSyncExternalStore } from "react";
import { formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { DiveView } from "@/lib/views";
import { LineChart } from "./LineChart";
import { useUnits } from "./Units";

/** A phone's width, where the charts become tabs (the same breakpoint as the tab bar). */
const NARROW = "(max-width: 760px)";
const subscribeNarrow = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

type ChartKey = "depth" | "tank" | "ppo2" | "temp";

const minutes = (v: number) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`;

/**
 * The depth profile and, under it, one small chart per other measurement (tank pressure, ppO2,
 * temperature). Each has its own axis; they share the time axis and one crosshair. On a phone they
 * are tabs, one chart at a time, so the page doesn't become a long scroll of charts.
 */
export function ProfileCharts({ view }: { view: DiveView }) {
  const [hover, setHover] = useState<number | null>(null);
  const [tab, setTab] = useState<ChartKey>("depth");
  const narrow = useNarrow();
  const { show, value, unit } = useUnits();
  const t = useT();
  const lang = useLang();
  const num = (v: number, digits: number) => formatNumber(v, digits, "", lang);
  // Values in the diver's units; a missing one stays missing.
  const to = (quantity: Parameters<typeof value>[0], v: number | null) => (v === null ? null : value(quantity, v));
  const { profile } = view;
  const x = profile.map((p) => p.tMin);
  const has = (key: "tankBar" | "ppo2" | "tempC" | "ceilingM") => profile.some((p) => p[key] !== null);
  const shared = { x, formatX: minutes, xUnit: t("charts.time"), hover, onHover: setHover, labelMargin: true };
  const ascent = (i: number) => [{ label: t("charts.ascentRate"), value: show("speed", Math.max(0, profile[i].ascentMMin)) }];

  if (!profile.length) return <p className="muted">{t("charts.noProfile")}</p>;
  const charts: ChartKey[] = ["depth", ...(has("tankBar") ? (["tank"] as const) : []), ...(has("ppo2") ? (["ppo2"] as const) : []), ...(has("tempC") ? (["temp"] as const) : [])];
  const showing = (key: ChartKey) => !narrow || (charts.includes(tab) ? tab : "depth") === key;
  return (
    <div className="stack">
      {narrow && charts.length > 1 && (
        <div className="tabs chart-tabs" role="tablist" aria-label={t("charts.charts")}>
          {charts.map((key) => (
            <button key={key} type="button" role="tab" aria-selected={showing(key)} onClick={() => setTab(key)}>
              {t(`charts.tab.${key}`)}
            </button>
          ))}
        </div>
      )}
      {showing("depth") && (
        <div>
          <h3>{t("charts.depth")}</h3>
          <LineChart
            {...shared}
            title={t("charts.depthProfile")}
            invertY
            includeY={[0]}
            height={260}
            formatY={(v) => `${num(v, 1)} ${unit("depth")}`}
            series={[
              { key: "depth", label: t("charts.depth"), color: "var(--series-1)", values: profile.map((p) => value("depth", p.depthM)) },
              ...(has("ceilingM") ? [{ key: "ceiling", label: t("charts.decoStop"), color: "var(--series-2)", values: profile.map((p) => to("depth", p.ceilingM)) }] : []),
            ]}
            bands={view.fastAscents.map((a) => ({ from: a.fromMin, to: a.toMin, label: t("charts.fastAscent"), color: "var(--serious)" }))}
            markers={view.gasSwitches.map((g) => ({ x: g.tMin, label: `→ ${g.gas}` }))}
            extraRows={ascent}
          />
        </div>
      )}
      {has("tankBar") && showing("tank") && (
        <div>
          <h3>{t("charts.tankPressure")}</h3>
          <LineChart {...shared} title={t("charts.tankPressure")} height={140} formatY={(v) => `${num(v, 0)} ${unit("pressure")}`} includeY={[0]} series={[{ key: "tank", label: t("charts.tankPressure"), color: "var(--series-1)", values: profile.map((p) => to("pressure", p.tankBar)) }]} />
        </div>
      )}
      {has("ppo2") && showing("ppo2") && (
        <div>
          <h3>ppO2</h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            {t("charts.ppo2Lines")}
          </p>
          <LineChart
            {...shared}
            title="ppO2"
            height={140}
            formatY={(v) => `${num(v, 2)} bar`}
            includeY={[0]}
            refLines={[
              { y: 1.4, label: t("charts.work") },
              { y: 1.6, label: t("charts.deco") },
            ]}
            series={[{ key: "ppo2", label: "ppO2", color: "var(--series-1)", values: profile.map((p) => p.ppo2) }]}
          />
        </div>
      )}
      {has("tempC") && showing("temp") && (
        <div>
          <h3>{t("charts.waterTemp")}</h3>
          <LineChart {...shared} title={t("charts.waterTemp")} height={120} formatY={(v) => `${num(v, 1)} ${unit("temperature")}`} series={[{ key: "temp", label: t("charts.temperature"), color: "var(--series-1)", values: profile.map((p) => to("temperature", p.tempC)) }]} />
        </div>
      )}
    </div>
  );
}
