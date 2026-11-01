"use client";

import { useState } from "react";
import { useLive } from "@/components/useLive";
import { useT } from "@/lib/i18n/useLang";
import type { GearKind, GearSet, Water } from "@/lib/kit";
import { BalanceCard } from "@/components/gear/BalanceCard";
import { EMPTY_ITEM, type ItemForm } from "./_parts/ItemEditor";
import { ItemsSection } from "./_parts/ItemsSection";
import { MakeItSure } from "./_parts/MakeItSure";
import { ResultCard } from "@/components/gear/ResultCard";
import { SetEditor } from "./_parts/SetEditor";
import { SitesCard } from "./_parts/SitesCard";
import type { Data, TankChoice } from "@/components/gear/shared";
import { YouStrip } from "@/components/gear/YouStrip";

export default function GearPage() {
  const { data, error, loading, reload } = useLive<Data>("/api/kit");
  const t = useT();
  const [setId, setSetId] = useState<string | null>(null);
  const [waterChoice, setWaterChoice] = useState<Water | null>(null);
  const [tank, setTank] = useState<TankChoice>("own");
  const [editingItem, setEditingItem] = useState<ItemForm | null>(null);
  const [editingSet, setEditingSet] = useState<GearSet | "new" | null>(null);
  const [editYou, setEditYou] = useState(0);
  if (error && !data) return <div className="error">{t("gearPage.loadFailed", { error })}</div>;
  if (!data) return <p className="muted">{t("gearPage.loading")}</p>;

  const set = data.sets.find((s) => s.id === setId) ?? data.sets[0] ?? null;
  const water = waterChoice ?? set?.water ?? "salt";
  const estimate = set ? (tank === "own" ? data.estimates[set.id]?.[water] : data.rentalEstimates?.[set.id]?.[tank]?.[water]) : undefined;
  const ownTank = set ? data.items.find((i) => i.kind === "tank" && set.itemIds.includes(i.id)) : undefined;
  const hasTank = tank !== "own" || !!ownTank;
  const you = estimate?.parts.find((p) => !p.itemId);
  const addItem = (kind: GearKind = "suit") => setEditingItem({ ...EMPTY_ITEM, kind, material: "aluminium" });

  return (
    <div className={`stack ${loading ? "loading" : ""}`} style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.gear")}</h1>
        <div className="row" style={{ gap: "0.5rem" }}>
          <button className="button" type="button" onClick={() => addItem()}>
            {t("gearPage.addGear")}
          </button>
          <button className="button primary" type="button" onClick={() => setEditingSet("new")}>
            {t("gearPage.newSet")}
          </button>
        </div>
      </div>

      <YouStrip key={editYou} kit={data} you={you} water={water} startEditing={editYou > 0} onSaved={reload} />

      <div className="tabs set-tabs" role="tablist" aria-label={t("gearPage.sets")}>
        {data.sets.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === set?.id}
            onClick={() => {
              setSetId(s.id);
              setWaterChoice(null);
              setEditingSet(null);
            }}
          >
            {s.name} <span className="muted">· {t("gearPage.items", { n: s.itemIds.length })}</span>
          </button>
        ))}
        <button type="button" role="tab" aria-selected={false} className="new-set" onClick={() => setEditingSet("new")}>
          + {t("gearPage.newSet")}
        </button>
      </div>

      {editingSet && (
        <SetEditor
          key={editingSet === "new" ? "new" : editingSet.id}
          kit={data}
          initial={editingSet === "new" ? null : editingSet}
          onDone={(id) => {
            setEditingSet(null);
            if (id !== undefined) setSetId(id || null);
            reload();
          }}
        />
      )}

      {set && !editingSet && (
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="secondary">
            {[
              set.ballastKg !== undefined ? t("gearPage.usualLead", { kg: set.ballastKg }) : null,
              set.water ? t("gearPage.meantFor", { water: t(`water.long.${set.water}`) }) : null,
              set.notes,
            ]
              .filter(Boolean)
              .join(" · ") || t("gearPage.noUsual")}
          </span>
          <button className="button small" type="button" onClick={() => setEditingSet(set)}>
            {t("gearPage.editSet")}
          </button>
        </div>
      )}

      {!set && !editingSet && (
        <div className="notice row" style={{ justifyContent: "space-between" }}>
          <span>{t("gearPage.noSet")}</span>
          <button className="button small" type="button" onClick={() => setEditingSet("new")}>
            {t("gearPage.createSet")}
          </button>
        </div>
      )}

      {set && estimate && (
        <div className="balance-grid">
          <BalanceCard estimate={estimate} hasTank={hasTank} water={water} setWater={setWaterChoice} tank={tank} setTank={setTank} ownTank={ownTank} />
          <ResultCard estimate={estimate} hasTank={hasTank} />
        </div>
      )}

      {set && estimate && (
        <MakeItSure
          kit={data}
          set={set}
          estimate={estimate}
          hasTank={hasTank}
          onAddTank={() => addItem("tank")}
          onEditYou={() => setEditYou((n) => n + 1)}
          onSaved={reload}
        />
      )}

      <ItemsSection kit={data} set={set} parts={estimate?.parts ?? []} editing={editingItem} setEditing={setEditingItem} onSaved={reload} />

      <SitesCard data={data} onSaved={reload} />
    </div>
  );
}
