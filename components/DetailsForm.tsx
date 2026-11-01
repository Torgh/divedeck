"use client";

import { type FormEvent, useState } from "react";
import { gasLabel } from "@/lib/dive";
import { useT } from "@/lib/i18n/useLang";
import { type Kit, type Water, waterOf } from "@/lib/kit";
import type { WeightingEstimate } from "@/lib/weighting";
import type { DiveDetails } from "@/lib/record";
import { api } from "./useLive";

/** What the dive computer doesn't record, filled in by the diver. Empty fields are removed. */
type KitView = Kit & { estimates?: Record<string, Record<Water, WeightingEstimate>> };

export function DetailsForm({ id, details, site, kit, onSaved }: { id: string; details: DiveDetails; site: string | null; kit: KitView | null; onSaved: () => void }) {
  const initial = {
    site: details.site ?? "",
    location: details.location ?? "",
    buddy: details.buddy ?? "",
    tankVolumeL: details.tankVolumeL?.toString() ?? "",
    gas: details.gas ? gasLabel({ id: "", name: "", ...details.gas }) : "",
    notes: details.notes ?? "",
    gearSetId: details.gearSetId ?? "",
    ballastKg: details.ballastKg?.toString() ?? "",
    water: details.water ?? "",
    weighting: details.weighting ?? "",
  };
  const t = useT();
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // The site's water, shown as what an unset dive takes.
  const siteWater = kit ? (waterOf(kit, {}, site)?.water ?? null) : null;
  const water = (form.water || siteWater) as Water | null;
  const estimate = form.gearSetId && water ? kit?.estimates?.[form.gearSetId]?.[water] : undefined;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const volume = form.tankVolumeL.trim().replace(",", ".");
    if (volume && !(Number(volume) > 0)) {
      setStatus({ ok: false, text: t("details.badVolume") });
      return;
    }
    const lead = form.ballastKg.trim().replace(",", ".");
    if (lead && !(Number(lead) >= 0)) {
      setStatus({ ok: false, text: t("details.badLead") });
      return;
    }
    setSaving(true);
    try {
      await api(`/api/dives/${id}`, "PATCH", {
        site: form.site,
        location: form.location,
        buddy: form.buddy,
        notes: form.notes,
        tankVolumeL: volume ? Number(volume) : null,
        gas: form.gas.trim() || null,
        gearSetId: form.gearSetId || null,
        ballastKg: lead ? Number(lead) : null,
        water: form.water || null,
        weighting: form.weighting || null,
      });
      setStatus({ ok: true, text: t("details.saved") });
      onSaved();
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={save}>
      <label>
        {t("details.site")}
        <input value={form.site} onChange={set("site")} placeholder={t("details.sitePlaceholder")} />
      </label>
      <label>
        {t("details.location")}
        <input value={form.location} onChange={set("location")} placeholder={t("details.locationPlaceholder")} />
      </label>
      <label>
        {t("details.buddy")}
        <input value={form.buddy} onChange={set("buddy")} />
      </label>
      <label>
        {t("details.volume")}
        <input value={form.tankVolumeL} onChange={set("tankVolumeL")} inputMode="decimal" placeholder={t("details.volumePlaceholder")} />
      </label>
      <label>
        {t("details.gas")}
        <input value={form.gas} onChange={set("gas")} placeholder="air, EAN32, Tx 18/45" />
      </label>
      <label>
        {t("details.gearSet")}
        <select value={form.gearSetId} onChange={set("gearSetId")}>
          <option value="">{kit?.sets.length ? t("details.noSet") : t("details.noSetsYet")}</option>
          {kit?.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("details.lead")}
        <input
          value={form.ballastKg}
          onChange={set("ballastKg")}
          inputMode="decimal"
          placeholder={(() => {
            const usual = kit?.sets.find((s) => s.id === form.gearSetId)?.ballastKg;
            return usual !== undefined ? t("details.usually", { kg: usual }) : t("details.leadPlaceholder");
          })()}
        />
      </label>
      {estimate && (
        <p className="wide muted" style={{ margin: "-0.3rem 0 0" }}>
          {t("details.estimated", { water: t(`water.long.${estimate.water}`) })} <strong>{estimate.leadKg === null ? "–" : `${estimate.leadKg} kg`}</strong>
          {estimate.calibration ? `, ${t("weighting.confidence.corrected", { n: estimate.calibration.dives })}` : ""} {t("details.onGearPage")}
        </p>
      )}
      <label>
        {t("details.water")}
        <select value={form.water} onChange={set("water")}>
          <option value="">{siteWater ? t("details.asSite", { water: t(`water.name.${siteWater}`) }) : t("details.waterNotSet")}</option>
          <option value="fresh">{t("water.name.fresh")}</option>
          <option value="brackish">{t("water.name.brackish")}</option>
          <option value="salt">{t("water.name.salt")}</option>
        </select>
      </label>
      <label>
        {t("details.felt")}
        <select value={form.weighting} onChange={set("weighting")}>
          <option value="">{t("details.notNoted")}</option>
          <option value="light">{t("feel.light")}</option>
          <option value="ok">{t("feel.ok")}</option>
          <option value="heavy">{t("feel.heavy")}</option>
        </select>
      </label>
      <label className="wide">
        {t("details.notes")}
        <textarea value={form.notes} onChange={set("notes")} rows={3} />
      </label>
      <div className="row wide">
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? t("common.saving") : t("details.save")}
        </button>
        {status && (
          <span className={status.ok ? "secondary" : ""} role="status" style={status.ok ? undefined : { color: "var(--critical)" }}>
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
