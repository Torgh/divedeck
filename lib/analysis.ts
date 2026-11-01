/**
 * Deterministic dive analytics, ported from the Python version (tag v0.1-python).
 *
 * Computes gas consumption, ascent rates, oxygen exposure, safety-stop and deco compliance, and
 * turns them into findings a diver can act on. Works without any AI; the coach builds on these
 * numbers. Texts print numbers the way Python does (`14.0`), so both versions read the same.
 */

import { type Dive, type GasMix, gasLabel } from "./dive";
import { type Key, LOCALE, type Lang, type Messages, type Params, translate } from "./i18n";
import { formatFixed, pyFloat, pyMax, pyMean, pyMin, pyRound, pySignedFloat, pySum } from "./py";

export const SURFACE_BAR = 1.013;
export const ASCENT_WARN_M_MIN = 10;
export const ASCENT_CRIT_M_MIN = 18;
export const PPO2_WORK_LIMIT = 1.4;
export const PPO2_DECO_LIMIT = 1.6;
export const PPO2_HYPOXIC = 0.16;
export const END_LIMIT_M = 30;
export const RESERVE_WARN_BAR = 50;
export const RESERVE_CRIT_BAR = 30;
export const SAFETY_STOP_S = 180;
export const SAWTOOTH_AMPLITUDE_M = 4;

/** NOAA single-exposure CNS limits: [ppO2 bar, minutes]. */
const NOAA_CNS: [number, number][] = [
  [0.6, 720], [0.7, 570], [0.8, 450], [0.9, 360], [1.0, 300], [1.1, 240],
  [1.2, 210], [1.3, 180], [1.4, 150], [1.5, 120], [1.6, 45],
];

export type Severity = "critical" | "warning" | "info" | "good";
export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface DiveMetrics {
  durationMin: number;
  maxDepthM: number;
  avgDepthM: number;
  minTempC: number | null;
  gasUsedL: number | null;
  /** Surface-equivalent respiratory minute volume. */
  rmvLMin: number | null;
  /** Only for single-tank dives. */
  sacBarMin: number | null;
  endPressureBar: number | null;
  maxAscentRateMMin: number;
  avgAscentRateMMin: number;
  fastAscentSeconds: number;
  maxDescentRateMMin: number;
  maxPpo2: number | null;
  minPpo2: number | null;
  maxEndM: number | null;
  cnsPercent: number;
  otu: number;
  safetyStopS: number;
  hadDeco: boolean;
  ceilingViolationS: number;
  minNdlMin: number | null;
  sawtoothCount: number;
  gases: string[];
  alarms: string[];
  score: number;
}

export interface DiveAnalysis {
  metrics: DiveMetrics;
  findings: Finding[];
}

export function ambientBar(depthM: number): number {
  return SURFACE_BAR + Math.max(depthM, 0) / 10;
}

/** Percent of the CNS clock used per minute at this ppO2. */
export function cnsRatePerMin(ppo2: number): number {
  if (ppo2 < 0.5) return 0;
  if (ppo2 <= NOAA_CNS[0][0]) return 100 / NOAA_CNS[0][1];
  for (let i = 0; i + 1 < NOAA_CNS.length; i++) {
    const [p1, m1] = NOAA_CNS[i];
    const [p2, m2] = NOAA_CNS[i + 1];
    if (p1 <= ppo2 && ppo2 <= p2) return 100 / (m1 + ((m2 - m1) * (ppo2 - p1)) / (p2 - p1));
  }
  // Beyond 1.6 bar the exposure limit collapses quickly; extrapolate harshly.
  return 100 / Math.max(5, 45 - (ppo2 - 1.6) * 200);
}

/** The gas breathed at each sample, following gas switches. */
function mixTimeline(dive: Dive): (GasMix | null)[] {
  const mixes = Object.values(dive.gasMixes);
  const mixOf = (id: string | null | undefined) => (id && Object.hasOwn(dive.gasMixes, id) ? dive.gasMixes[id] : null);
  let current = mixOf(dive.tanks[0]?.mixId) ?? (mixes.length === 1 ? mixes[0] : null);
  return dive.samples.map((s) => {
    current = mixOf(s.mixRef) ?? current;
    return current;
  });
}

/** [time, depth, rate m/min] over a trailing window; a positive rate is ascending. */
function windowedRates(times: number[], depths: number[], windowS = 30): [number, number, number][] {
  const rates: [number, number, number][] = [];
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] > windowS && j < i) j++;
    let k = j;
    if (times[i] - times[k] < windowS / 2 && k > 0) k--;
    const dt = times[i] - times[k];
    rates.push([times[i], depths[i], dt > 0 ? ((depths[k] - depths[i]) / dt) * 60 : 0]);
  }
  return rates;
}

/** ppO2 at each sample: the computer's value, else the breathed gas's O2 fraction × ambient pressure. */
export function ppo2Series(dive: Dive): (number | null)[] {
  const mixes = mixTimeline(dive);
  return dive.samples.map((sample, i) => sample.ppo2 ?? (mixes[i] ? mixes[i]!.o2 * ambientBar(sample.depthM) : null));
}

export function ascentRateSeries(dive: Dive): [number, number, number][] {
  return windowedRates(
    dive.samples.map((s) => s.timeS),
    dive.samples.map((s) => s.depthM),
  );
}

const roundOrNull = (x: number | null, n = 0) => (x === null ? null : pyRound(x, n));

export function analyzeDive(dive: Dive, lang: Lang = "en"): DiveAnalysis {
  const s = dive.samples;
  const times = s.map((x) => x.timeS);
  const depths = s.map((x) => x.depthM);
  const durationMin = dive.durationS / 60;

  // Time-weighted average depth
  let avgDepth: number;
  if (s.length >= 2) {
    const area = pySum(times.slice(1).map((t, i) => ((t - times[i]) * (depths[i] + depths[i + 1])) / 2));
    const span = times[times.length - 1] - times[0];
    avgDepth = span > 0 ? area / span : depths[0];
  } else {
    avgDepth = dive.maxDepthM / 2;
  }

  // Gas consumption: [start bar, end bar, volume L] of each tank used; 0 bar at the start means it wasn't.
  let gasUsedL: number | null = null;
  let sac: number | null = null;
  let endPressure: number | null = null;
  const usable = dive.tanks.flatMap((t) =>
    t.startBar && t.endBar !== null ? [[t.startBar, t.endBar, t.volumeL] as const] : [],
  );
  if (usable.length) {
    endPressure = pyMin(usable.map(([, end]) => end));
    const usedL = usable.flatMap(([start, end, vol]) => (vol ? [(start - end) * vol] : []));
    if (usedL.length) gasUsedL = pySum(usedL);
    if (usable.length === 1 && durationMin > 0) {
      const [start, end] = usable[0];
      sac = ((start - end) / durationMin / ambientBar(avgDepth)) * SURFACE_BAR;
    }
  }
  let rmv: number | null = null;
  if (gasUsedL && durationMin > 0) rmv = gasUsedL / durationMin / (ambientBar(avgDepth) / SURFACE_BAR);

  // Ascent / descent
  const rates = windowedRates(times, depths);
  const ascending = rates.flatMap(([, d, r]) => (r > 0.5 && d > 0.5 ? [r] : []));
  const maxAscent = rates.length ? pyMax(rates.map(([, , r]) => r)) : 0;
  const maxDescent = rates.length ? pyMax(rates.map(([, , r]) => -r)) : 0;
  let fastAscentS = 0;
  for (let i = 1; i < rates.length; i++) {
    if (rates[i][2] > ASCENT_WARN_M_MIN && rates[i][1] > 0.5) fastAscentS += Math.trunc(times[i] - times[i - 1]);
  }

  // Oxygen exposure, END
  const mixes = mixTimeline(dive);
  const ppo2s = ppo2Series(dive);
  let maxEnd: number | null = null;
  let cns = 0;
  let otu = 0;
  for (let i = 0; i < s.length; i++) {
    const sample = s[i];
    const mix = mixes[i];
    const p = ppo2s[i];
    if (mix) {
      const end = (sample.depthM + 10) * (1 - mix.he) - 10;
      maxEnd = maxEnd === null ? end : Math.max(maxEnd, end);
    }
    if (p !== null && i > 0) {
      const dtMin = (times[i] - times[i - 1]) / 60;
      cns += cnsRatePerMin(p) * dtMin;
      if (p > 0.5) otu += dtMin * ((p - 0.5) / 0.5) ** 0.83;
    }
  }
  const computerCns = s.flatMap((x) => (x.cns === null ? [] : [x.cns]));
  if (computerCns.length) cns = pyMax(computerCns);
  const knownPpo2 = ppo2s.filter((p): p is number => p !== null);
  const maxPpo2 = knownPpo2.length ? pyMax(knownPpo2) : null;
  const deepPpo2 = ppo2s.filter((p, i): p is number => p !== null && depths[i] > 1);
  const minPpo2 = deepPpo2.length ? pyMin(deepPpo2) : null;
  if (!mixes.some((m) => m !== null && m.he > 0)) maxEnd = null; // END is only interesting for helium mixes

  // Deco & safety stop
  const hadDeco = s.some((x) => Boolean(x.decoDepthM));
  let ceilingViolationS = 0;
  for (let i = 1; i < s.length; i++) {
    const stopM = s[i].decoDepthM;
    if (stopM && depths[i] < stopM - 0.5) ceilingViolationS += Math.trunc(times[i] - times[i - 1]);
  }
  let safetyStopS = 0;
  if (s.length) {
    const deepest = depths.indexOf(pyMax(depths));
    for (let i = deepest + 1; i < s.length; i++) {
      if (depths[i] >= 2.5 && depths[i] <= 6.5) safetyStopS += Math.trunc(times[i] - times[i - 1]);
    }
  }
  const ndls = s.flatMap((x) => (x.ndlS === null ? [] : [x.ndlS / 60]));
  const minNdl = ndls.length ? pyMin(ndls) : null;

  const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
  const alarms = sorted(s.flatMap((x) => x.alarms));
  const breathed = sorted(mixes.flatMap((m) => (m ? [gasLabel(m)] : [])));
  const gases = breathed.length ? breathed : sorted(Object.values(dive.gasMixes).map(gasLabel));

  const metrics: DiveMetrics = {
    durationMin: pyRound(durationMin, 1),
    maxDepthM: pyRound(dive.maxDepthM, 1),
    avgDepthM: pyRound(avgDepth, 1),
    minTempC: roundOrNull(dive.minTempC, 1),
    gasUsedL: roundOrNull(gasUsedL),
    rmvLMin: roundOrNull(rmv, 1),
    sacBarMin: roundOrNull(sac, 2),
    endPressureBar: roundOrNull(endPressure),
    maxAscentRateMMin: pyRound(maxAscent, 1),
    avgAscentRateMMin: ascending.length ? pyRound(pyMean(ascending), 1) : 0,
    fastAscentSeconds: fastAscentS,
    maxDescentRateMMin: pyRound(maxDescent, 1),
    maxPpo2: roundOrNull(maxPpo2, 2),
    minPpo2: roundOrNull(minPpo2, 2),
    maxEndM: roundOrNull(maxEnd, 1),
    cnsPercent: pyRound(cns, 1),
    otu: pyRound(otu, 1),
    safetyStopS,
    hadDeco,
    ceilingViolationS,
    minNdlMin: roundOrNull(minNdl, 1),
    sawtoothCount: countSawtooth(depths),
    gases,
    alarms,
    score: 100,
  };
  const findings = diveFindings(metrics, lang);
  metrics.score = score(findings);
  return { metrics, findings };
}

/** Re-descents of at least SAWTOOTH_AMPLITUDE_M after an ascent of the same size. */
export function countSawtooth(depths: number[]): number {
  if (!depths.length) return 0;
  let count = 0;
  let low = depths[0];
  let high = depths[0];
  let direction = 0; // 1 descending, -1 ascending
  for (const d of depths.slice(1)) {
    if (direction >= 0) {
      if (d > high) high = d;
      else if (high - d >= SAWTOOTH_AMPLITUDE_M) [direction, low] = [-1, d];
    } else if (d < low) {
      low = d;
    } else if (d - low >= SAWTOOTH_AMPLITUDE_M && low > 1) {
      count++;
      [direction, high] = [1, d];
    }
  }
  return count;
}

/** Python's number printing in English (`14.0`, so both versions read the same); the language's own otherwise. */
const numbers = (lang: Lang) =>
  lang === "en"
    ? { f: pyFloat, fixed0: (x: number) => formatFixed(x, 0) }
    : { f: (x: number) => x.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 }), fixed0: (x: number) => x.toLocaleString(LOCALE[lang], { maximumFractionDigits: 0 }) };

type FindingKey = keyof Messages["finding"];

function diveFindings(m: DiveMetrics, lang: Lang): Finding[] {
  const out: Finding[] = [];
  const { f, fixed0 } = numbers(lang);
  const add = (severity: Severity, key: FindingKey, params: Params = {}) =>
    out.push({ severity, title: translate(lang, `finding.${key}.title`), detail: translate(lang, `finding.${key}.detail`, params) });

  if (m.maxAscentRateMMin > ASCENT_CRIT_M_MIN) {
    add("critical", "veryFastAscent", { rate: f(m.maxAscentRateMMin), limit: fixed0(ASCENT_WARN_M_MIN) });
  } else if (m.fastAscentSeconds > 20) {
    add("warning", "fastAscent", { s: m.fastAscentSeconds, limit: fixed0(ASCENT_WARN_M_MIN), rate: f(m.maxAscentRateMMin) });
  } else if (m.maxDepthM > 3) {
    add("good", "controlledAscent", { rate: f(m.maxAscentRateMMin) });
  }

  if (m.ceilingViolationS > 0) {
    add("critical", "ceilingViolated", { s: m.ceilingViolationS });
  } else if (m.hadDeco) {
    add("good", "decoCompleted");
  }

  if (!m.hadDeco && m.maxDepthM >= 10) {
    if (m.safetyStopS >= SAFETY_STOP_S) add("good", "safetyStopDone", { min: Math.floor(m.safetyStopS / 60), s: m.safetyStopS % 60 });
    else add("warning", "safetyStopShort", { s: m.safetyStopS });
  }

  if (m.maxPpo2 !== null) {
    const limit = m.hadDeco ? PPO2_DECO_LIMIT : PPO2_WORK_LIMIT;
    if (m.maxPpo2 > PPO2_DECO_LIMIT) add("critical", "ppo2Above16", { ppo2: f(m.maxPpo2) });
    else if (m.maxPpo2 > limit) add("warning", "ppo2High", { ppo2: f(m.maxPpo2), limit: f(PPO2_WORK_LIMIT) });
  }
  if (m.minPpo2 !== null && m.minPpo2 < PPO2_HYPOXIC) add("critical", "hypoxic", { ppo2: f(m.minPpo2) });

  if (m.cnsPercent >= 80) add("critical", "cnsVeryHigh", { cns: f(m.cnsPercent) });
  else if (m.cnsPercent >= 50) add("warning", "cnsElevated", { cns: f(m.cnsPercent) });

  if (m.maxEndM !== null && m.maxEndM > END_LIMIT_M) add("warning", "endHigh", { end: f(m.maxEndM) });

  if (m.endPressureBar !== null) {
    if (m.endPressureBar < RESERVE_CRIT_BAR) add("critical", "tankEmpty", { bar: m.endPressureBar });
    else if (m.endPressureBar < RESERVE_WARN_BAR) add("warning", "reserveLow", { bar: m.endPressureBar, reserve: fixed0(RESERVE_WARN_BAR) });
  }

  if (m.rmvLMin !== null) {
    if (m.rmvLMin > 25) add("warning", "rmvHigh", { rmv: f(m.rmvLMin) });
    else if (m.rmvLMin < 15) add("good", "rmvLow", { rmv: f(m.rmvLMin) });
  }

  if (m.minNdlMin !== null && !m.hadDeco && m.minNdlMin < 3) add("warning", "nearNdl", { ndl: f(m.minNdlMin) });

  if (m.sawtoothCount >= 3) add("warning", "sawtooth", { n: m.sawtoothCount });

  if (m.maxDescentRateMMin > 30) add("info", "fastDescent", { rate: f(m.maxDescentRateMMin) });

  for (const alarm of m.alarms) add("warning", "alarm", { alarm });

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function score(findings: Finding[]): number {
  const penalty: Record<Severity, number> = { critical: 25, warning: 10, info: 2, good: 0 };
  return Math.max(0, 100 - findings.reduce((sum, x) => sum + penalty[x.severity], 0));
}

// ---------------------------------------------------------------------------
// History / progress
// ---------------------------------------------------------------------------

/** A dive in the log: its metrics, plus the titles of its findings. */
export type HistoryEntry = Partial<DiveMetrics> & { findingTitles?: string[] };

export type ProgressMetric =
  | "rmvLMin"
  | "sacBarMin"
  | "maxAscentRateMMin"
  | "fastAscentSeconds"
  | "score"
  | "safetyStopS"
  | "maxDepthM"
  | "durationMin";

/** Label, which direction is better, and whether the values are whole numbers. */
export const PROGRESS_METRICS: Record<ProgressMetric, { label: string; better: "lower" | "higher" | "neutral"; integer: boolean }> = {
  rmvLMin: { label: "Gas consumption (RMV, L/min)", better: "lower", integer: false },
  sacBarMin: { label: "SAC (bar/min)", better: "lower", integer: false },
  maxAscentRateMMin: { label: "Peak ascent rate (m/min)", better: "lower", integer: false },
  fastAscentSeconds: { label: "Time ascending too fast (s)", better: "lower", integer: true },
  score: { label: "Dive quality score", better: "higher", integer: true },
  safetyStopS: { label: "Safety stop time (s)", better: "higher", integer: true },
  maxDepthM: { label: "Max depth (m)", better: "neutral", integer: false },
  durationMin: { label: "Duration (min)", better: "neutral", integer: false },
};

export interface Trend {
  metric: ProgressMetric;
  label: string;
  dives: number;
  earlyAvg: number;
  recentAvg: number;
  changePct: number;
  slopePerDive: number;
  best: number;
  verdict: "improving" | "worsening" | "stable";
}

function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = pyMean(values);
  const den = pySum(values.map((_, x) => (x - mx) ** 2));
  return den ? pySum(values.map((y, x) => (x - mx) * (y - my))) / den : 0;
}

/** How a metric evolved over dives in chronological order, or null with fewer than 3 values. */
export function trend(history: HistoryEntry[], metric: ProgressMetric): Trend | null {
  return trendWithAverages(history, metric)?.trend ?? null;
}

/**
 * The trend, plus the averages as Python prints them: the mean of whole numbers is an int when it
 * divides evenly (`95`), otherwise a float (`95.5`, or `95.0` once rounded).
 */
function trendWithAverages(
  history: HistoryEntry[],
  metric: ProgressMetric,
): { trend: Trend; early: string; recent: string } | null {
  const values = history.flatMap((h) => (h[metric] === null || h[metric] === undefined ? [] : [h[metric] as number]));
  if (values.length < 3) return null;
  const { label, better } = PROGRESS_METRICS[metric];
  const half = Math.max(1, Math.floor(values.length / 2));
  const early = pyMean(values.slice(0, half));
  const recent = pyMean(values.slice(-half));
  // From 0 (e.g. no safety stop at first) any change is the whole of it: count it as ±100 %.
  const changePct = early ? ((recent - early) / early) * 100 : recent ? Math.sign(recent) * 100 : 0;
  let verdict: Trend["verdict"];
  if (better === "neutral" || Math.abs(changePct) < 5) verdict = "stable";
  else verdict = changePct < 0 === (better === "lower") ? "improving" : "worsening";
  const printed = (mean: number) =>
    PROGRESS_METRICS[metric].integer && Number.isInteger(mean) ? String(mean) : pyFloat(pyRound(mean, 2));
  return {
    trend: {
      metric,
      label,
      dives: values.length,
      earlyAvg: pyRound(early, 2),
      recentAvg: pyRound(recent, 2),
      changePct: pyRound(changePct, 1),
      slopePerDive: pyRound(slope(values), 3),
      best: pyRound(better === "lower" ? pyMin(values) : pyMax(values), 2),
      verdict,
    },
    early: printed(early),
    recent: printed(recent),
  };
}

const GOOD_FINDINGS: FindingKey[] = ["controlledAscent", "safetyStopDone", "rmvLow", "decoCompleted"];

/** Plain-language progress notes from the whole dive log, in chronological order. */
export function progressInsights(history: HistoryEntry[], lang: Lang = "en"): Finding[] {
  const t = (key: Key, params?: Params) => translate(lang, key, params);
  const out: Finding[] = [];
  if (history.length < 3) return [{ severity: "info", title: t("progress.notEnough.title"), detail: t("progress.notEnough.detail") }];
  for (const metric of ["rmvLMin", "maxAscentRateMMin", "fastAscentSeconds", "score", "safetyStopS"] as const) {
    const found = trendWithAverages(history, metric);
    if (!found || found.trend.verdict === "stable") continue;
    const t2 = found.trend;
    const english = lang === "en";
    out.push({
      severity: t2.verdict === "improving" ? "good" : "warning",
      title: t(`progress.${t2.verdict as "improving" | "worsening"}`, { metric: english ? t2.label : t(`progress.metric.${metric}`) }),
      detail: t("progress.trendDetail", {
        early: english ? found.early : formatLocal(t2.earlyAvg, lang),
        recent: english ? found.recent : formatLocal(t2.recentAvg, lang),
        change: english ? pySignedFloat(t2.changePct) : `${t2.changePct > 0 ? "+" : ""}${formatLocal(t2.changePct, lang)}`,
        n: t2.dives,
      }),
    });
  }
  const window = history.slice(-6);
  const good = new Set(GOOD_FINDINGS.map((key) => t(`finding.${key}.title`)));
  const recurring = new Map<string, number>();
  for (const h of window) for (const title of h.findingTitles ?? []) recurring.set(title, (recurring.get(title) ?? 0) + 1);
  for (const [title, count] of [...recurring].sort((a, b) => b[1] - a[1])) {
    if (count >= 3 && !good.has(title)) {
      out.push({
        severity: "warning",
        title: t("progress.recurring.title", { title }),
        detail: t("progress.recurring.detail", { count, n: window.length }),
      });
    }
  }
  if (!out.length) out.push({ severity: "info", title: t("progress.consistent.title"), detail: t("progress.consistent.detail") });
  return out;
}

const formatLocal = (x: number, lang: Lang) => x.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 });
