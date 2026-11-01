"use client";

import { useState } from "react";
import { Command } from "@/components/Command";
import { FoldedMarkdown } from "@/components/FoldedMarkdown";
import type { TripEdit } from "@/components/TripPrep";
import { useUnits } from "@/components/Units";
import { api } from "@/components/useLive";
import { formatDate } from "@/lib/format";
import type { T } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { SavedText, SiteStatus, TripShop, TripSite } from "@/lib/trip";

/** Depth range, distance, type and entry, in a few words. */
export function siteFacts(
  site: Pick<TripSite, "minDepthM" | "maxDepthM" | "distanceKm" | "type" | "entry">,
  range: (min: number | undefined, max: number | undefined) => string | null,
  t: T,
): string {
  return [
    range(site.minDepthM, site.maxDepthM),
    site.distanceKm !== undefined ? t("sites.fromShop", { km: site.distanceKm }) : null,
    site.type,
    site.entry ? t("sites.entry", { entry: site.entry }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A link to where the site's facts come from, when it is a web page. */
function SourceLink({ site }: { site: TripSite }) {
  const t = useT();
  if (!site.source?.startsWith("http")) return null;
  return (
    <a className="muted" href={site.source} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: "0.85rem" }}>
      {t("sites.source")}
    </a>
  );
}

function SiteCard({ site, busy, onChoose }: { site: TripSite; busy: boolean; onChoose?: (status: SiteStatus) => void }) {
  const { range } = useUnits();
  const t = useT();
  const line = siteFacts(site, (min, max) => range("depth", min, max), t);
  return (
    <article className={`card site-card ${site.status}`} id={`site-${site.id}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <strong>{site.name}</strong>
          {line && (
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {line}
            </div>
          )}
        </div>
        {site.status === "chosen" && <span className="pill chosen">{t("sites.chosen")}</span>}
      </div>
      <p style={{ margin: 0 }}>{site.why}</p>
      <div className="row" style={{ gap: "0.4rem", marginTop: "auto" }}>
        {onChoose && site.status !== "chosen" && (
          <button className="button small primary" type="button" disabled={busy} onClick={() => onChoose("chosen")}>
            {t("sites.choose")}
          </button>
        )}
        {onChoose && site.status === "proposed" && (
          <button className="button small" type="button" disabled={busy} onClick={() => onChoose("dropped")}>
            {t("sites.notThis")}
          </button>
        )}
        {onChoose && site.status === "chosen" && (
          <button className="button small" type="button" disabled={busy} onClick={() => onChoose("proposed")}>
            {t("sites.undo")}
          </button>
        )}
        <SourceLink site={site} />
      </div>
    </article>
  );
}

/** A chosen site: what was proposed (facts, why it suits you, source) stays, and the profile follows. */
function ChosenSite({ site, busy, onUndo }: { site: TripSite; busy: boolean; onUndo?: () => void }) {
  const { range } = useUnits();
  const t = useT();
  const lang = useLang();
  const line = siteFacts(site, (min, max) => range("depth", min, max), t);
  return (
    <article className="card stack site-profile" id={`site-${site.id}`} aria-labelledby={`site-h-${site.id}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h3 id={`site-h-${site.id}`} style={{ margin: 0, fontSize: "1.05rem" }}>
            {site.name}
          </h3>
          {line && (
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {line}
            </div>
          )}
        </div>
        {onUndo && (
          <button className="button small" type="button" disabled={busy} onClick={onUndo}>
            {t("sites.undoChoice")}
          </button>
        )}
      </div>
      <div className="row" style={{ gap: "0.5rem", alignItems: "baseline" }}>
        <p style={{ margin: 0, flex: "1 1 260px" }}>{site.why}</p>
        <SourceLink site={site} />
      </div>
      {site.profile ? (
        <div className="review">
          <FoldedMarkdown markdown={site.profile.markdown} />
          <p className="muted">{t("sites.researched", { date: formatDate(site.profile.savedAt.slice(0, 19), true, lang) })}</p>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t("sites.notResearched")}
        </p>
      )}
    </article>
  );
}

/**
 * The dive sites your companion proposed around the trip's dive shop. You choose; it then researches
 * only the chosen ones, and their profiles show here. Without `edit` (the phone) the sites are only shown.
 */
export function TripSites({ trip, shop, sites, notes, edit }: { trip: string; shop: TripShop | null; sites: TripSite[]; notes: SavedText | null; edit?: TripEdit }) {
  const t = useT();
  const lang = useLang();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const scout = <Command text={`/mcp__divedeck__site-scout ${trip}`} />;

  async function choose(siteId: string, status: SiteStatus) {
    if (!edit) return;
    setBusy(true);
    setFailure(null);
    try {
      await api(`/api/trips/${edit.tripId}/sites`, "POST", { siteId, status });
      edit.onChange();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!sites.length)
    return (
      <section className="card stack" id="sites" aria-labelledby="sites-h">
        <h2 id="sites-h" style={{ margin: 0 }}>
          {t("sites.title")}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {edit ? (
            <>
              {t("sites.introEdit")} {scout}
            </>
          ) : (
            t("sites.intro")
          )}
        </p>
      </section>
    );

  const chosen = sites.filter((s) => s.status === "chosen");
  const proposed = sites.filter((s) => s.status === "proposed");
  const dropped = sites.filter((s) => s.status === "dropped");
  const waiting = chosen.filter((s) => !s.profile);
  return (
    <section className="stack" id="sites" style={{ gap: "0.75rem" }} aria-labelledby="sites-h">
      <div className="chart-head">
        <h2 id="sites-h" style={{ margin: 0 }}>
          {t("sites.title")}
        </h2>
        {shop && <span className="muted">{t("sites.around", { shop: shop.name })}</span>}
      </div>

      {notes && (
        <section className="card review" aria-labelledby="site-notes-h">
          <h3 id="site-notes-h" style={{ marginTop: 0 }}>
            {t("sites.weighed")}
          </h3>
          <FoldedMarkdown markdown={notes.markdown} />
          <p className="muted">{t("common.savedOn", { date: formatDate(notes.savedAt.slice(0, 19), true, lang) })}</p>
        </section>
      )}

      {chosen.map((site) => (
        <ChosenSite key={site.id} site={site} busy={busy} onUndo={edit && (() => choose(site.id, "proposed"))} />
      ))}

      {waiting.length > 0 && (
        <div className="notice">
          {waiting.length === 1 ? t("sites.waitingOne", { name: waiting[0].name }) : t("sites.waiting", { n: waiting.length })}
          {edit ? <>: {scout}</> : ` ${t("sites.onPc")}`}
        </div>
      )}

      {proposed.length > 0 && (
        <>
          <h3 className="group-title">{chosen.length ? t("sites.more") : edit ? t("sites.proposedEdit") : t("sites.proposed")}</h3>
          <div className="gear-grid">
            {proposed.map((site) => (
              <SiteCard key={site.id} site={site} busy={busy} onChoose={edit && ((status) => choose(site.id, status))} />
            ))}
          </div>
        </>
      )}

      {dropped.length > 0 && (
        <details>
          <summary className="muted">
            {t("sites.dropped", { n: dropped.length, names: dropped.map((s) => s.name).join(", ") })}
          </summary>
          <div className="gear-grid" style={{ marginTop: "0.6rem" }}>
            {dropped.map((site) => (
              <SiteCard key={site.id} site={site} busy={busy} onChoose={edit && ((status) => choose(site.id, status))} />
            ))}
          </div>
        </details>
      )}

      {failure && <div className="error">{failure}</div>}
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        {rich(t("sites.credits"), {
          a: (s) => (
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              {s}
            </a>
          ),
        })}
      </p>
    </section>
  );
}
