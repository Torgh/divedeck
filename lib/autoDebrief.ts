/**
 * A debrief written from the numbers alone, without AI: what went well, what to work on, and one
 * drill for the next dive. The phone shows it until the companion's debrief comes from the PC.
 */

import {
  ASCENT_CRIT_M_MIN,
  ASCENT_WARN_M_MIN,
  type DiveMetrics,
  NDL_INFO_MIN,
  PPO2_WORK_LIMIT,
  RESERVE_CRIT_BAR,
  RESERVE_WARN_BAR,
  SAFETY_STOP_S,
} from "./analysis";
import { formatNumber, formatSeconds } from "./format";
import { type Key, type Lang, type Params, translate } from "./i18n";

type Drill = "deco" | "gas" | "ascent" | "stop" | "breathing" | "ndl" | "sawtooth";

/** The debrief as Markdown; `averages` are the diver's other dives, to compare with. */
export function autoDebrief(m: DiveMetrics, averages: Partial<Record<keyof DiveMetrics, number>> = {}, lang: Lang = "en"): string {
  const t = (key: Key, params?: Params) => translate(lang, key, params);
  const n = (x: number, digits = 1) => formatNumber(x, digits, "", lang);
  const good: string[] = [];
  const work: string[] = [];
  const drills: Drill[] = [];
  const avgRmv = averages.rmvLMin;

  if (m.ceilingViolationS > 0) {
    work.push(t("debrief.work.ceiling", { time: formatSeconds(m.ceilingViolationS, lang) }));
    drills.push("deco");
  } else if (m.hadDeco) good.push(t("debrief.good.deco"));

  if (m.endPressureBar !== null) {
    if (m.endPressureBar < RESERVE_CRIT_BAR) {
      work.push(t("debrief.work.tankEmpty", { bar: m.endPressureBar }));
      drills.push("gas");
    } else if (m.endPressureBar < RESERVE_WARN_BAR) {
      work.push(t("debrief.work.reserveLow", { bar: m.endPressureBar, reserve: RESERVE_WARN_BAR }));
      drills.push("gas");
    } else good.push(t("debrief.good.reserve", { bar: m.endPressureBar }));
  }

  if (m.maxAscentRateMMin > ASCENT_CRIT_M_MIN || m.fastAscentSeconds > 20) {
    work.push(t("debrief.work.fastAscent", { s: m.fastAscentSeconds, rate: n(m.maxAscentRateMMin), limit: ASCENT_WARN_M_MIN }));
    drills.push("ascent");
  } else if (m.maxDepthM > 3) good.push(t("debrief.good.ascent", { rate: n(m.maxAscentRateMMin) }));

  if (!m.hadDeco && m.maxDepthM >= 10) {
    if (m.safetyStopS >= SAFETY_STOP_S) good.push(t("debrief.good.stop", { time: formatSeconds(m.safetyStopS, lang) }));
    else {
      work.push(t("debrief.work.stopShort", { time: formatSeconds(m.safetyStopS, lang) }));
      drills.push("stop");
    }
  }

  if (m.rmvLMin !== null) {
    const bottom = m.bottomRmvLMin !== null && m.bottomRmvLMin >= m.rmvLMin * 1.2 ? t("debrief.work.atBottom", { bottom: n(m.bottomRmvLMin) }) : "";
    if (m.rmvLMin > 25) {
      work.push(t("debrief.work.rmvHigh", { rmv: n(m.rmvLMin), bottom }));
      drills.push("breathing");
    } else if (avgRmv !== undefined && m.rmvLMin > avgRmv * 1.15) {
      work.push(t("debrief.work.rmvWorse", { rmv: n(m.rmvLMin), avg: n(avgRmv), bottom }));
      drills.push("breathing");
    } else if (m.rmvLMin < 15) good.push(t("debrief.good.rmvLow", { rmv: n(m.rmvLMin) }));
    else if (avgRmv !== undefined && m.rmvLMin < avgRmv * 0.95) good.push(t("debrief.good.rmvBetter", { rmv: n(m.rmvLMin), avg: n(avgRmv) }));
  }

  if (m.minNdlMin !== null && !m.hadDeco && m.minNdlMin <= NDL_INFO_MIN) {
    work.push(t("debrief.work.ndl", { ndl: n(m.minNdlMin, 0) }));
    drills.push("ndl");
  }

  if (m.maxPpo2 !== null && m.maxPpo2 > PPO2_WORK_LIMIT) work.push(t("debrief.work.ppo2", { ppo2: n(m.maxPpo2, 2), limit: PPO2_WORK_LIMIT }));
  if (m.cnsPercent >= 50) work.push(t("debrief.work.cns", { cns: n(m.cnsPercent) }));

  if (m.sawtoothCount >= 3) {
    work.push(t("debrief.work.sawtooth", { n: m.sawtoothCount }));
    drills.push("sawtooth");
  } else if (m.maxDepthM >= 10 && m.sawtoothCount === 0) good.push(t("debrief.good.steady"));

  const lines = [t("debrief.intro"), "", `### ${t("debrief.wentWell")}`, ""];
  lines.push(...(good.length ? good : [t("debrief.good.none")]).map((x) => `- ${x}`));
  lines.push("", `### ${t("debrief.toWorkOn")}`, "");
  lines.push(...(work.length ? work : [t("debrief.work.none")]).map((x) => `- ${x}`));
  lines.push("", `### ${t("debrief.nextDive")}`, "");
  lines.push(drills.length ? t(`debrief.drill.${drills[0]}`) : m.rmvLMin !== null ? t("debrief.drill.keepRmv", { rmv: n(m.rmvLMin) }) : t("debrief.drill.keep"));
  return lines.join("\n");
}
