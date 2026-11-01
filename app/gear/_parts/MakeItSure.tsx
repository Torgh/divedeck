import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/useLang";
import type { GearSet, Kit } from "@/lib/kit";
import type { WeightingEstimate } from "@/lib/weighting";
import { Failure, num, useSave } from "@/components/gear/shared";

/** The few things that would make the estimate sure, each with a way to do it here. */
export function MakeItSure({
  kit,
  set,
  estimate,
  hasTank,
  onAddTank,
  onEditYou,
  onSaved,
}: {
  kit: Kit;
  set: GearSet;
  estimate: WeightingEstimate;
  hasTank: boolean;
  onAddTank: () => void;
  onEditYou: () => void;
  onSaved: () => void;
}) {
  const { save, failure } = useSave();
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  const unknown = estimate.parts.filter((p) => p.status === "unknown" && p.itemId);
  const d = kit.diver;
  const steps: { key: string; title: string; why: string; action: React.ReactNode }[] = [];
  if (!hasTank)
    steps.push({
      key: "tank",
      title: t("sure.tankTitle"),
      why: t("sure.tankWhy"),
      action: (
        <button className="button primary" type="button" onClick={onAddTank}>
          {t("sure.addTank")}
        </button>
      ),
    });
  for (const p of unknown) {
    const id = p.itemId!;
    steps.push({
      key: id,
      title: t("sure.buoyancyTitle", { name: p.label }),
      why: t("sure.buoyancyWhy"),
      action: (
        <form
          className="row"
          style={{ gap: "0.5rem" }}
          onSubmit={async (e) => {
            e.preventDefault();
            const v = num(values[id] ?? "");
            if (v !== null && (await save({ items: [{ id, buoyancyKg: v }] }))) onSaved();
          }}
        >
          <label className="row" style={{ gap: "0.4rem", fontSize: "0.9rem" }}>
            <span className="secondary">{t("sure.kgFloats")}</span>
            <input className="small-input" value={values[id] ?? ""} onChange={(e) => setValues({ ...values, [id]: e.target.value })} inputMode="decimal" placeholder={t("gear.eg", { value: "+0.8" })} />
          </label>
          <button className="button" type="submit">
            {t("common.save")}
          </button>
        </form>
      ),
    });
  }
  if (d.heightCm === undefined || d.bodyFatPercent === undefined)
    steps.push({
      key: "you",
      title: d.heightCm === undefined && d.bodyFatPercent === undefined ? t("sure.addBoth") : d.heightCm === undefined ? t("sure.addHeight") : t("sure.addFat"),
      why: t("sure.youWhy"),
      action: (
        <button className="button" type="button" onClick={onEditYou}>
          {t("sure.editYou")}
        </button>
      ),
    });
  if (!estimate.calibration || estimate.calibration.dives < 3)
    steps.push({
      key: "dives",
      title: t("sure.logTitle"),
      why: t("sure.logWhy", { set: set.name }),
      action: (
        <Link className="button" href="/dives">
          {t("sure.openLog")}
        </Link>
      ),
    });
  if (!steps.length) return null;
  return (
    <section className="card" aria-labelledby="sure-h">
      <h2 id="sure-h">{t("sure.title")}</h2>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.key}>
            <span className="step-mark" role="img" aria-label={t("start.step", { n: i + 1 })}>
              {i + 1}
            </span>
            <div className="row" style={{ justifyContent: "space-between", flex: 1 }}>
              <div style={{ flex: "1 1 260px" }}>
                <strong>{s.title}</strong>
                <p className="secondary" style={{ fontSize: "0.9rem" }}>
                  {s.why}
                </p>
              </div>
              {s.action}
            </div>
          </li>
        ))}
      </ol>
      <Failure text={failure} />
    </section>
  );
}
