import { type FormEvent, useState } from "react";
import { GEAR_KINDS, type GearItem, type GearKind, type GearSet, type KitChange } from "@/lib/kit";
import { Failure, num, str, useSave } from "@/components/gear/shared";
import { useT } from "@/lib/i18n/useLang";

export const EMPTY_ITEM = {
  id: "",
  name: "",
  kind: "suit" as GearKind,
  brand: "",
  buoyancyKg: "",
  weightKg: "",
  suitType: "wetsuit",
  thicknessMm: "",
  thicknessLimbsMm: "",
  undergarment: "",
  size: "",
  ageYears: "",
  material: "aluminium",
  volumeL: "",
  workingPressureBar: "",
  emptyBuoyancyKg: "",
  plate: "steel",
  notes: "",
};
export type ItemForm = typeof EMPTY_ITEM;

export const toForm = (item: GearItem): ItemForm => ({ ...EMPTY_ITEM, ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, str(v)])), kind: item.kind });

/** Only the fields that belong to the kind are sent; the others are removed. */
function itemChange(form: ItemForm): NonNullable<KitChange["items"]>[number] {
  const k = form.kind;
  const neoprene = k === "suit" || k === "hood" || k === "gloves" || k === "boots";
  const dry = k === "suit" && form.suitType === "drysuit";
  return {
    ...(form.id ? { id: form.id } : {}),
    name: form.name.trim(),
    kind: k,
    brand: form.brand.trim() || null,
    notes: form.notes.trim() || null,
    buoyancyKg: k === "tank" ? null : num(form.buoyancyKg),
    weightKg: num(form.weightKg),
    suitType: k === "suit" ? (form.suitType as GearItem["suitType"]) : null,
    thicknessMm: neoprene && !dry ? num(form.thicknessMm) : null,
    thicknessLimbsMm: k === "suit" && !dry ? num(form.thicknessLimbsMm) : null,
    undergarment: dry ? form.undergarment.trim() || null : null,
    size: k === "suit" || k === "boots" || k === "fins" ? form.size.trim() || null : null,
    ageYears: neoprene ? num(form.ageYears) : null,
    material: k === "tank" ? (form.material as GearItem["material"]) : null,
    volumeL: k === "tank" ? num(form.volumeL) : null,
    workingPressureBar: k === "tank" ? num(form.workingPressureBar) : null,
    emptyBuoyancyKg: k === "tank" ? num(form.emptyBuoyancyKg) : null,
    plate: k === "bcd" ? (form.plate as GearItem["plate"]) : null,
  };
}

/** Adds or changes a piece of gear; a new one can go straight into the set on screen. */
export function ItemEditor({ initial, set, onDone }: { initial: ItemForm; set: GearSet | null; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const [intoSet, setIntoSet] = useState(!!set && !initial.id);
  const { save, busy, failure } = useSave();
  const t = useT();
  const field = (key: keyof ItemForm) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const k = form.kind;
  const neoprene = k === "suit" || k === "hood" || k === "gloves" || k === "boots";
  const dry = k === "suit" && form.suitType === "drysuit";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const kit = await save({ items: [itemChange(form)] });
    if (!kit) return;
    if (intoSet && set) {
      const added = [...kit.items].reverse().find((i) => i.name === form.name.trim());
      if (added && !set.itemIds.includes(added.id) && !(await save({ sets: [{ id: set.id, items: [...set.itemIds, added.id] }] }))) return;
    }
    onDone();
  }
  async function remove() {
    if (window.confirm(t("itemEditor.confirmRemove", { name: form.name })) && (await save({ remove: { items: [form.id] } }))) onDone();
  }

  return (
    <form className="form card item-editor" onSubmit={submit}>
      <label>
        {t("setEditor.name")}
        <input value={form.name} onChange={field("name")} required placeholder={t("itemEditor.namePlaceholder")} />
      </label>
      <label>
        {t("itemEditor.kind")}
        <select value={form.kind} onChange={field("kind")}>
          {GEAR_KINDS.map((g) => (
            <option key={g} value={g}>
              {t(`gear.kind.${g}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("itemEditor.brand")}
        <input value={form.brand} onChange={field("brand")} />
      </label>
      {k === "suit" && (
        <label>
          {t("gear.kind.suit")}
          <select value={form.suitType} onChange={field("suitType")}>
            <option value="wetsuit">{t("gear.suitType.wetsuit")}</option>
            <option value="semidry">{t("gear.suitType.semidry")}</option>
            <option value="drysuit">{t("gear.suitType.drysuit")}</option>
          </select>
        </label>
      )}
      {neoprene && !dry && (
        <label>
          {k === "suit" ? t("itemEditor.torso") : t("itemEditor.neoprene")}
          <input value={form.thicknessMm} onChange={field("thicknessMm")} inputMode="decimal" placeholder={t("gear.eg", { value: 3 })} />
        </label>
      )}
      {k === "suit" && !dry && (
        <label>
          {t("itemEditor.limbs")}
          <input value={form.thicknessLimbsMm} onChange={field("thicknessLimbsMm")} inputMode="decimal" placeholder={t("itemEditor.limbsPlaceholder")} />
        </label>
      )}
      {dry && (
        <label>
          {t("itemEditor.undergarment")}
          <input value={form.undergarment} onChange={field("undergarment")} placeholder={t("itemEditor.undergarmentPlaceholder")} />
        </label>
      )}
      {(k === "suit" || k === "boots" || k === "fins") && (
        <label>
          {t("itemEditor.size")}
          <input value={form.size} onChange={field("size")} placeholder={t("gear.eg", { value: "M" })} />
        </label>
      )}
      {neoprene && (
        <label>
          {t("itemEditor.age")}
          <input value={form.ageYears} onChange={field("ageYears")} inputMode="decimal" />
        </label>
      )}
      {k === "tank" && (
        <>
          <label>
            {t("itemEditor.material")}
            <select value={form.material} onChange={field("material")}>
              <option value="aluminium">{t("itemEditor.aluminium")}</option>
              <option value="steel">{t("itemEditor.steel")}</option>
              <option value="carbon">{t("itemEditor.carbon")}</option>
            </select>
          </label>
          <label>
            {t("itemEditor.volume")}
            <input value={form.volumeL} onChange={field("volumeL")} inputMode="decimal" placeholder={t("gear.eg", { value: 11.1 })} />
          </label>
          <label>
            {t("itemEditor.pressure")}
            <input value={form.workingPressureBar} onChange={field("workingPressureBar")} inputMode="decimal" placeholder={t("gear.eg", { value: 207 })} />
          </label>
          <label>
            {t("itemEditor.emptyBuoyancy")}
            <input value={form.emptyBuoyancyKg} onChange={field("emptyBuoyancyKg")} inputMode="decimal" placeholder={t("itemEditor.emptyPlaceholder")} />
          </label>
        </>
      )}
      {k === "bcd" && (
        <label>
          {t("itemEditor.backplate")}
          <select value={form.plate} onChange={field("plate")}>
            <option value="steel">{t("itemEditor.steel")}</option>
            <option value="aluminium">{t("itemEditor.aluminium")}</option>
            <option value="none">{t("itemEditor.jacket")}</option>
          </select>
        </label>
      )}
      {k !== "tank" && (
        <label>
          {t("itemEditor.buoyancy")}
          <input value={form.buoyancyKg} onChange={field("buoyancyKg")} inputMode="decimal" placeholder={t("itemEditor.ifWeighed")} />
        </label>
      )}
      <label>
        {t("itemEditor.weight")}
        <input value={form.weightKg} onChange={field("weightKg")} inputMode="decimal" />
      </label>
      <label className="wide">
        {t("details.notes")}
        <input value={form.notes} onChange={field("notes")} />
      </label>
      {set && !initial.id && (
        <label className="wide check">
          <input type="checkbox" checked={intoSet} onChange={(e) => setIntoSet(e.target.checked)} />
          {t("itemEditor.addTo", { set: set.name })}
        </label>
      )}
      <div className="row wide">
        <button className="button primary" type="submit" disabled={busy || !form.name.trim()}>
          {busy ? t("common.saving") : initial.id ? t("common.save") : t("common.add")}
        </button>
        <button className="button" type="button" onClick={onDone}>
          {t("common.cancel")}
        </button>
        {initial.id && (
          <button className="button" type="button" disabled={busy} onClick={remove} style={{ marginLeft: "auto" }}>
            {t("common.remove")}
          </button>
        )}
        <Failure text={failure} />
      </div>
    </form>
  );
}
