import { useUnits } from "@/components/Units";
import type { T } from "@/lib/i18n";
import { useT } from "@/lib/i18n/useLang";
import type { GearItem } from "@/lib/kit";
import type { Part } from "@/lib/weighting";
import { BuoyancyPill, KindIcon } from "./shared";

/** What a piece of gear is, in a few short words. */
function chips(item: GearItem, weight: (kg: number) => string, t: T): string[] {
  return [
    item.kind === "suit" && item.thicknessMm && item.thicknessLimbsMm
      ? t("gear.card.split", { torso: item.thicknessMm, limbs: item.thicknessLimbsMm })
      : item.thicknessMm
        ? `${item.thicknessMm} mm`
        : null,
    item.undergarment ?? null,
    item.size ? t("gear.card.size", { size: item.size }) : null,
    item.ageYears !== undefined ? t("gear.card.age", { n: item.ageYears }) : null,
    item.volumeL ? `${item.volumeL} L` : null,
    item.workingPressureBar ? `${item.workingPressureBar} bar` : null,
    item.emptyBuoyancyKg !== undefined ? t("gear.card.empty", { kg: `${item.emptyBuoyancyKg > 0 ? "+" : "−"}${weight(Math.abs(item.emptyBuoyancyKg))}` }) : null,
    item.weightKg !== undefined ? t("gear.card.onLand", { kg: weight(item.weightKg) }) : null,
  ].filter((c): c is string => !!c);
}

function typeLine(item: GearItem, t: T): string {
  const kind = item.kind === "suit" && item.suitType ? t(`gear.suitType.${item.suitType}`) : t(`gear.kind.${item.kind}`);
  const extra =
    item.kind === "bcd" && item.plate
      ? item.plate === "none"
        ? t("gear.card.jacket")
        : t("gear.card.plate", { material: t(`weighting.material.${item.plate}`) })
      : item.kind === "tank" && item.material
        ? t(`weighting.material.${item.material}`)
        : null;
  return [kind, extra, item.brand && item.brand !== item.name ? item.brand : null].filter(Boolean).join(" · ");
}

/** A piece of gear; without `onEdit` (the phone) only shown. */
export function GearCard({ item, part, onEdit, action }: { item: GearItem; part: Part | undefined; onEdit?: () => void; action?: React.ReactNode }) {
  const { show } = useUnits();
  const t = useT();
  const list = chips(item, (kg) => show("weight", kg), t);
  return (
    <article className={`card gear-card ${part?.status === "unknown" ? "warn" : ""}`}>
      <div className="gear-card-head">
        <KindIcon kind={item.kind} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{item.name}</strong>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {typeLine(item, t)}
          </div>
        </div>
        <BuoyancyPill part={part} />
      </div>
      {list.length > 0 && (
        <div className="chip-list">
          {list.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
      {item.notes && (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {item.notes}
        </p>
      )}
      {(onEdit || action) && (
        <div className="row" style={{ gap: "0.4rem", marginTop: "auto" }}>
          {onEdit && (
            <button className="button small" type="button" onClick={onEdit}>
              {t("common.edit")}
            </button>
          )}
          {action}
        </div>
      )}
    </article>
  );
}
