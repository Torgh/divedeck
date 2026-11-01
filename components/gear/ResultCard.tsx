import { useUnits } from "@/components/Units";
import { useT } from "@/lib/i18n/useLang";
import type { WeightingEstimate } from "@/lib/weighting";

export function ResultCard({ estimate, hasTank }: { estimate: WeightingEstimate; hasTank: boolean }) {
  const { show } = useUnits();
  const t = useT();
  const total = estimate.parts.reduce((s, p) => s + p.kg, 0);
  const c = estimate.confidence;
  return (
    <section className="card result" aria-labelledby="lead-h">
      <h2 id="lead-h" className="eyebrow" style={{ margin: 0 }}>
        {[t("gear.result.lead"), t(`water.long.${estimate.water}`), estimate.rentalTank ? t(`weighting.rental.${estimate.rentalTank}.short`) : null].filter(Boolean).join(" · ")}
      </h2>
      <div className="lead">{estimate.leadKg === null ? "–" : show("weight", estimate.leadKg)}</div>
      <p style={{ margin: 0 }}>
        {estimate.leadKg === null
          ? t("gear.result.massFirst")
          : estimate.calibration
            ? t("gear.result.corrected", {
                n: estimate.calibration.dives,
                offset: `${estimate.calibration.offsetKg > 0 ? "+" : ""}${show("weight", estimate.calibration.offsetKg)}`,
              })
            : total < 0
              ? `${t("gear.result.sinks", { kg: show("weight", -total) })}${hasTank ? "" : ` ${t("gear.result.tankDecides")}`}`
              : t("gear.result.floats", { kg: show("weight", total) })}
      </p>
      <div className="stack" style={{ gap: "0.35rem" }}>
        <div className="row" style={{ justifyContent: "space-between", fontSize: "0.85rem" }}>
          <strong>{t("gear.result.howSure")}</strong>
          <span className={`confidence ${c.level}`}>{t(`gear.result.level.${c.level}`)}</span>
        </div>
        <div className="meter" role="img" aria-label={t("gear.result.howSureAria", { level: t(`gear.result.level.${c.level}`), score: c.score })}>
          <span className={`confidence-fill ${c.level}`} style={{ width: `${c.score}%` }} />
        </div>
        <ul className="secondary" style={{ margin: "0.2rem 0 0", paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
          {c.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
