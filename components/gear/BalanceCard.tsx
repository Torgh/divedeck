import { useUnits } from "@/components/Units";
import { type GearItem, type Water, WATERS } from "@/lib/kit";
import type { T } from "@/lib/i18n";
import { useT } from "@/lib/i18n/useLang";
import { RENTAL_TANK_IDS, type WeightingEstimate } from "@/lib/weighting";
import type { TankChoice } from "./shared";

/** "Your Tank (steel 15 L)", or that the set has none. */
const ownLabel = (tank: GearItem | undefined, t: T) =>
  tank
    ? t("gear.balance.yours", {
        tank: [tank.material ? t(`weighting.material.${tank.material}`) : null, tank.volumeL ? `${tank.volumeL} L` : null].filter(Boolean).join(" ") || tank.name,
      })
    : t("gear.balance.yoursNone");

/** Bars from a centre line: what floats goes right in blue, what sinks goes left in orange. */
export function BalanceCard({
  estimate,
  hasTank,
  water,
  setWater,
  tank,
  setTank,
  ownTank,
}: {
  estimate: WeightingEstimate;
  hasTank: boolean;
  water: Water;
  setWater: (w: Water) => void;
  tank: TankChoice;
  setTank: (t: TankChoice) => void;
  ownTank: GearItem | undefined;
}) {
  const { show } = useUnits();
  const t = useT();
  const parts = estimate.parts;
  const total = parts.reduce((s, p) => s + p.kg, 0);
  // The diver is the one part without a piece of gear.
  const isYou = (p: (typeof parts)[number]) => !p.itemId;
  const shown = parts.filter((p) => isYou(p) || p.kg !== 0 || p.status === "unknown");
  const zero = parts.filter((p) => !shown.includes(p));
  const half = Math.max(3, Math.ceil(Math.max(...parts.map((p) => Math.abs(p.kg)), Math.abs(total))));
  const signed = (kg: number) => `${kg > 0 ? "+" : kg < 0 ? "−" : ""}${show("weight", Math.abs(kg))}`;
  const bar = (kg: number, typical: boolean, strong = false) => {
    const width = Math.max(0.8, (Math.min(Math.abs(kg), half) / half) * 50);
    return <span className={`bar ${strong ? "total" : kg >= 0 ? "floats" : "sinks"} ${typical ? "typical" : ""}`} style={{ left: `${kg >= 0 ? 50 : 50 - width}%`, width: `${width}%` }} />;
  };
  return (
    <section className="card balance" aria-labelledby="bal-h">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 id="bal-h" style={{ margin: 0 }}>
            {t("gear.balance.title")}
          </h2>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {t("gear.balance.at")}
          </span>
        </div>
        <div className="segmented" role="radiogroup" aria-label={t("details.water")}>
          {WATERS.map((w) => (
            <button key={w} type="button" role="radio" aria-checked={water === w} onClick={() => setWater(w)}>
              {t(`water.name.${w}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="row tank-choice">
        <span className="muted">{t("gear.kind.tank")}</span>
        <div className="segmented small" role="radiogroup" aria-label={t("gear.kind.tank")}>
          <button type="button" role="radio" aria-checked={tank === "own"} onClick={() => setTank("own")}>
            {ownLabel(ownTank, t)}
          </button>
          {RENTAL_TANK_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={tank === id} onClick={() => setTank(id)} title={t(`weighting.rental.${id}.name`)}>
              {((s) => s[0].toUpperCase() + s.slice(1))(t(`weighting.rental.${id}.short`))}
            </button>
          ))}
        </div>
      </div>
      <div className="balance-axis" aria-hidden="true">
        <span>◂ {t("gear.balance.sinks")}</span>
        <span>{t("gear.balance.floats")} ▸</span>
      </div>
      <ul className="balance-rows" aria-label={t("gear.balance.inWater", { water: t(`water.long.${water}`) })}>
        {shown.map((p) => (
          <li key={p.label}>
            <span className="label">
              {isYou(p) ? <strong>{p.label}</strong> : p.label}
              {p.status === "typical" && !isYou(p) && <span className="tag">{t("gear.balance.typical")}</span>}
            </span>
            {p.status === "unknown" ? (
              <span className="track unknown">{t("gear.balance.unknown")}</span>
            ) : (
              <span className="track" title={p.why}>
                {bar(p.kg, p.status === "typical")}
              </span>
            )}
            <span className="value">{p.status === "unknown" ? "?" : signed(p.kg)}</span>
          </li>
        ))}
        {!hasTank && (
          <li>
            <span className="label secondary">{t("gear.kind.tank")}</span>
            <span className="track missing">{t("gear.balance.noTank")}</span>
            <span className="value">–</span>
          </li>
        )}
        {zero.length > 0 && (
          <li className="zero">
            <details>
              <summary>
                {t("gear.balance.zero", { n: zero.length, names: zero.map((p) => p.label).join(", ") })}
              </summary>
              <span className="muted">{t("gear.balance.zeroHelp")}</span>
            </details>
          </li>
        )}
        <li className="sum">
          <span className="label">
            <strong>{t("gear.balance.together")}</strong>
          </span>
          <span className="track">{bar(total, false, true)}</span>
          <span className="value">{signed(total)}</span>
        </li>
      </ul>
    </section>
  );
}
