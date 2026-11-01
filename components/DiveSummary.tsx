import { RESERVE_WARN_BAR } from "@/lib/analysis";
import { formatNumber, formatSeconds } from "@/lib/format";
import type { T } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { DiveView } from "@/lib/views";
import { useUnits } from "./Units";

/* A dive's score, headline and metrics. Shared by the web app and the phone app. */

/** The score on a ring, out of 100. */
export function ScoreRing({ score }: { score: number }) {
  const t = useT();
  const r = 50;
  const length = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 120 120" width="112" height="112" role="img" aria-label={t("summary.scoreAria", { score })}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--grid)" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(length * Math.max(0, Math.min(score, 100))) / 100} ${length}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="66" textAnchor="middle" fontSize="30" fontWeight="700">
        {score}
      </text>
      <text className="of" x="60" y="86" textAnchor="middle" fontSize="11">
        {t("summary.of100")}
      </text>
    </svg>
  );
}

/** One sentence from the findings: how many things need attention. */
export function headline(findings: DiveView["findings"], t: T) {
  const count = (severity: string) => findings.filter((f) => f.severity === severity).length;
  const [critical, warning] = [count("critical"), count("warning")];
  if (critical) return warning ? t("summary.seriousAndWatch", { n: critical, more: warning }) : t("summary.serious", { n: critical });
  if (warning) return t("summary.watch", { n: warning });
  return t("summary.clean");
}

/**
 * Profile, gas and safety in three cards. `detailsHref` links a missing tank size to the form that
 * fills it in; without it (the phone app) the card only says it is missing.
 */
export function MetricCards({ data, detailsHref }: { data: DiveView; detailsHref?: string }) {
  const { show, system } = useUnits();
  const t = useT();
  const lang = useLang();
  const { metrics: m, averages: avg } = data;
  const missingVolume = m.rmvLMin === null && data.tanks.some((t) => t.startBar && t.endBar !== null && !t.volumeL);
  const lowReserve = m.endPressureBar !== null && m.endPressureBar < RESERVE_WARN_BAR;
  const tank = data.tanks.find((t) => t.startBar !== null);
  const average = [
    avg.maxDepthM !== undefined ? show("depth", avg.maxDepthM) : null,
    avg.durationMin !== undefined ? formatNumber(avg.durationMin, 0, "min", lang) : null,
    avg.maxAscentRateMMin !== undefined ? show("speed", avg.maxAscentRateMMin) : null,
  ].filter(Boolean);
  const safetyFoot = [
    m.ceilingViolationS > 0 ? t("summary.ceilingBroken", { time: formatSeconds(m.ceilingViolationS, lang) }) : null,
    m.alarms.length ? t("summary.alarms", { alarms: m.alarms.join(", ") }) : null,
  ].filter(Boolean);
  return (
    <section className="metric-cards" aria-label={t("summary.metrics")}>
      <div className="card metric-card">
        <h3>{t("summary.profile")}</h3>
        <div className="kv">
          <span>{t("summary.maxDepth")}</span>
          <strong>{show("depth", m.maxDepthM)}</strong>
        </div>
        <div className="kv">
          <span>{t("summary.duration")}</span>
          <strong>{formatNumber(m.durationMin, 0, "min", lang)}</strong>
        </div>
        <div className="kv">
          <span>{t("summary.peakAscent")}</span>
          <strong>{show("speed", m.maxAscentRateMMin)}</strong>
        </div>
        {average.length > 0 && <span className="foot">{t("summary.yourAverage", { values: average.join(" · ") })}</span>}
      </div>

      <div className={`card metric-card ${missingVolume || lowReserve ? "warn" : ""}`}>
        <h3>{t("summary.gas")}</h3>
        <div className="kv">
          <span>{t("summary.gasLeft")}</span>
          <strong className={lowReserve ? "warn" : ""}>{show("pressure", m.endPressureBar)}</strong>
        </div>
        <div className="kv">
          <span>{t("summary.rmv")}</span>
          {missingVolume && detailsHref ? (
            <a href={detailsHref} style={{ fontWeight: 600 }}>
              {t("summary.addTank")}
            </a>
          ) : missingVolume ? (
            <span className="muted">{t("summary.tankUnknown")}</span>
          ) : (
            <strong>{show("flow", m.rmvLMin)}</strong>
          )}
        </div>
        <div className="kv">
          <span>CNS</span>
          <strong>{formatNumber(m.cnsPercent, 1, "%", lang)}</strong>
        </div>
        <span className="foot">
          {[
            tank ? `${show("pressure", tank.startBar)} → ${show("pressure", tank.endBar)}` : t("summary.noTankPressure"),
            m.maxPpo2 !== null ? t("summary.maxPpo2", { ppo2: formatNumber(m.maxPpo2, 2, "", lang) }) : null,
            m.gases.join(", ") || t("diveList.gasUnknown"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="card metric-card">
        <h3>{t("summary.safety")}</h3>
        <div className="kv">
          <span>{t("summary.timeAt", { range: system === "imperial" ? "10–20 ft" : "3–6 m" })}</span>
          <strong>{formatSeconds(m.safetyStopS, lang)}</strong>
        </div>
        <div className="kv">
          <span>{t("summary.lowestNdl")}</span>
          <strong>{m.minNdlMin !== null ? formatNumber(m.minNdlMin, 0, "min", lang) : "–"}</strong>
        </div>
        <div className="kv">
          <span>{t("summary.deco")}</span>
          <strong>{m.hadDeco ? t("summary.yes") : t("common.none")}</strong>
        </div>
        <span className="foot">{safetyFoot.length ? safetyFoot.join(" · ") : t("summary.noBreaches")}</span>
      </div>
    </section>
  );
}
