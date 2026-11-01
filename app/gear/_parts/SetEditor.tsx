import { type FormEvent, useState } from "react";
import { type GearSet, type Kit, type Water, WATERS } from "@/lib/kit";
import { Failure, num, str, useSave } from "@/components/gear/shared";
import { useT } from "@/lib/i18n/useLang";

export function SetEditor({ kit, initial, onDone }: { kit: Kit; initial: GearSet | null; onDone: (setId?: string) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [items, setItems] = useState<string[]>(initial?.itemIds ?? []);
  const [ballast, setBallast] = useState(str(initial?.ballastKg));
  const [water, setWater] = useState<string>(initial?.water ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const { save, busy, failure } = useSave();
  const t = useT();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const change = { ...(initial ? { id: initial.id } : {}), name: name.trim(), items, ballastKg: num(ballast), water: (water || null) as Water | null, notes: notes.trim() || null };
    const saved = await save({ sets: [change] });
    if (saved) onDone(initial?.id ?? [...saved.sets].reverse().find((s) => s.name === name.trim())?.id);
  }
  async function remove() {
    if (initial && window.confirm(t("setEditor.confirmRemove", { name: initial.name })) && (await save({ remove: { sets: [initial.id] } }))) onDone("");
  }
  const toggle = (id: string) => setItems(items.includes(id) ? items.filter((i) => i !== id) : [...items, id]);
  return (
    <form className="form card item-editor" onSubmit={submit}>
      <label>
        {t("setEditor.name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("setEditor.namePlaceholder")} />
      </label>
      <label>
        {t("setEditor.lead")}
        <input value={ballast} onChange={(e) => setBallast(e.target.value)} inputMode="decimal" placeholder={t("gear.eg", { value: 4 })} />
      </label>
      <label>
        {t("setEditor.meantFor")}
        <select value={water} onChange={(e) => setWater(e.target.value)}>
          <option value="">{t("setEditor.anyWater")}</option>
          {WATERS.map((w) => (
            <option key={w} value={w}>
              {t(`water.long.${w}`)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="wide" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="muted" style={{ fontSize: "0.85rem" }}>
          {t("setEditor.gearInSet")}
        </legend>
        <div className="chips" style={{ marginTop: "0.4rem" }}>
          {kit.items.map((i) => (
            <button key={i.id} type="button" className="chip" aria-pressed={items.includes(i.id)} onClick={() => toggle(i.id)}>
              {i.name}
            </button>
          ))}
          {!kit.items.length && <span className="muted">{t("setEditor.noGear")}</span>}
        </div>
      </fieldset>
      <label className="wide">
        {t("details.notes")}
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("setEditor.notesPlaceholder")} />
      </label>
      <div className="row wide">
        <button className="button primary" type="submit" disabled={busy || !name.trim()}>
          {busy ? t("common.saving") : initial ? t("common.save") : t("setEditor.add")}
        </button>
        <button className="button" type="button" onClick={() => onDone()}>
          {t("common.cancel")}
        </button>
        {initial && (
          <button className="button" type="button" disabled={busy} onClick={remove} style={{ marginLeft: "auto" }}>
            {t("setEditor.remove")}
          </button>
        )}
        <Failure text={failure} />
      </div>
    </form>
  );
}
