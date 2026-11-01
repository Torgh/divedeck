import { type FormEvent, useState } from "react";
import { useUnits } from "@/components/Units";
import { useT } from "@/lib/i18n/useLang";
import type { Kit, Water } from "@/lib/kit";
import type { Part } from "@/lib/weighting";
import { BuoyancyPill, Failure, num, str, useSave } from "./shared";

function DiverForm({ kit, onDone }: { kit: Kit; onDone: () => void }) {
  const [form, setForm] = useState({ massKg: str(kit.diver.massKg), heightCm: str(kit.diver.heightCm), bodyFatPercent: str(kit.diver.bodyFatPercent) });
  const { save, busy, failure } = useSave();
  const t = useT();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await save({ diver: { massKg: num(form.massKg), heightCm: num(form.heightCm), bodyFatPercent: num(form.bodyFatPercent) } })) onDone();
  }
  return (
    <form className="form" onSubmit={submit} style={{ flexBasis: "100%" }}>
      <label>
        {t("gear.you.mass")}
        <input value={form.massKg} onChange={set("massKg")} inputMode="decimal" placeholder={t("gear.eg", { value: 82 })} />
      </label>
      <label>
        {t("gear.you.height")}
        <input value={form.heightCm} onChange={set("heightCm")} inputMode="decimal" placeholder={t("gear.eg", { value: 183 })} />
      </label>
      <label>
        {t("gear.you.fat")}
        <input value={form.bodyFatPercent} onChange={set("bodyFatPercent")} inputMode="decimal" placeholder={t("gear.eg", { value: 18 })} />
      </label>
      <div className="row wide">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </button>
        <button className="button" type="button" onClick={onDone}>
          {t("common.cancel")}
        </button>
        <Failure text={failure} />
      </div>
    </form>
  );
}

/** Your body and your own buoyancy; without `onSaved` (the phone) only shown. */
export function YouStrip({ kit, you, water, startEditing = false, onSaved }: { kit: Kit; you: Part | undefined; water: Water; startEditing?: boolean; onSaved?: () => void }) {
  const [editing, setEditing] = useState(startEditing);
  const { show } = useUnits();
  const t = useT();
  const d = kit.diver;
  const facts = [
    d.massKg !== undefined ? show("weight", d.massKg) : null,
    d.heightCm !== undefined ? `${d.heightCm} cm` : null,
    d.bodyFatPercent !== undefined ? t("gear.you.fatValue", { fat: d.bodyFatPercent }) : null,
  ].filter(Boolean);
  return (
    <section className="card you-strip" aria-label={t("weighting.you")}>
      <span className="you-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </span>
      <div style={{ flex: "1 1 240px" }}>
        <strong>{t("weighting.you")}</strong>
        <div className="secondary">{facts.length ? facts.join(" · ") : t("gear.you.massNeeded")}</div>
      </div>
      {you && (
        <div style={{ flex: "1 1 240px", fontSize: "0.9rem" }}>
          <div className="secondary">{t("gear.you.own")}</div>
          <div>
            <BuoyancyPill part={you} /> {t("gear.you.inWater", { water: t(`water.long.${water}`) })}
          </div>
        </div>
      )}
      {onSaved && !editing && (
        <button className="button" type="button" onClick={() => setEditing(true)}>
          {t("common.edit")}
        </button>
      )}
      {onSaved && editing && (
        <DiverForm
          kit={kit}
          onDone={() => {
            setEditing(false);
            onSaved();
          }}
        />
      )}
    </section>
  );
}
