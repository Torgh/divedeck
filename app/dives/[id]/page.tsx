"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DetailsForm } from "@/components/DetailsForm";
import { headline, MetricCards, ScoreRing } from "@/components/DiveSummary";
import { FindingBadge, Findings } from "@/components/Findings";
import { FoldedMarkdown } from "@/components/FoldedMarkdown";
import { ProfileCharts } from "@/components/ProfileCharts";
import { api, useLive } from "@/components/useLive";
import { useUnits } from "@/components/Units";
import { useSettings } from "@/components/useSettings";
import { formatDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n/useLang";
import type { Kit, Water } from "@/lib/kit";
import type { WeightingEstimate } from "@/lib/weighting";
import type { DiveView } from "@/lib/views";
import { Command } from "@/components/Command";

type Data = DiveView & { version: string };

/** The companion's debrief, and a way to ask for one: here with an API key, or in Claude Code / Codex. */
function Debrief({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const { settings } = useSettings();
  const t = useT();
  const lang = useLang();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const provider = settings?.providers.find((p) => p.id === settings.provider);

  async function ask() {
    setBusy(true);
    setFailure(null);
    try {
      await api("/api/coach/review", "POST", { diveId: data.id, lang });
      onSaved();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review">
      {data.review ? (
        <>
          <FoldedMarkdown key={data.review.savedAt} markdown={data.review.markdown} />
          <p className="muted">{t("common.savedOn", { date: formatDate(data.review.savedAt.slice(0, 19), true, lang) })}</p>
        </>
      ) : (
        <p className="muted">{t("dive.noDebrief")}</p>
      )}
      {provider?.usesApi ? (
        <div className="row">
          <button className="button" disabled={busy} onClick={ask}>
            {busy ? t("dive.debriefing") : data.review ? t("dive.newDebrief") : t("dive.getDebrief")}
          </button>
          <span className="muted">{t("dive.billed", { name: provider.name })}</span>
        </div>
      ) : provider ? (
        <p className="muted">
          {t("dive.askIn", { app: provider.app ?? "" })} <Command text={`/mcp__divedeck__dive-review ${data.seq}`} />
        </p>
      ) : null}
      {failure && <div className="error">{failure}</div>}
    </div>
  );
}

/** Debrief and findings in one panel, as two tabs. */
function DebriefAndFindings({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<"debrief" | "findings">("debrief");
  const tabs = [
    { id: "debrief", label: t("diveList.debrief") },
    { id: "findings", label: t("dive.findings", { n: data.findings.length }) },
  ] as const;
  return (
    <section className="card" aria-label={t("dive.debriefAndFindings")}>
      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            id={`tab-${x.id}`}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            aria-controls={`panel-${x.id}`}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "debrief" ? <Debrief data={data} onSaved={onSaved} /> : <Findings findings={data.findings} />}
      </div>
    </section>
  );
}

export default function DivePage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useUnits();
  const t = useT();
  const lang = useLang();
  const { data, error, loading, reload } = useLive<Data>(`/api/dives/${id}`);
  const kit = useLive<Kit & { version: string; estimates: Record<string, Record<Water, WeightingEstimate>> }>("/api/kit").data;
  if (error && !data) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">{t("dive.loading")}</p>;
  const { dive, metrics } = data;
  const site = [dive.site, dive.location].filter(Boolean).join(", ");
  const shown = data.findings;

  return (
    <div className={`stack ${loading ? "loading" : ""}`} style={{ gap: "1.25rem" }}>
      <div className="dive-head">
        <div>
          <Link className="back" href="/dives">
            ‹ {t("nav.log")}
          </Link>
          <h1>{t("dive.title", { seq: data.seq })}</h1>
          <div className="secondary">
            {[formatDate(dive.start, true, lang), metrics.gases.join(", ") || t("diveList.gasUnknown"), dive.computer, data.details.buddy ? t("dive.with", { buddy: data.details.buddy }) : null]
              .filter(Boolean)
              .join(" · ")}
            {" · "}
            {site || <a href="#details">{t("dive.addSite")}</a>}
          </div>
        </div>
        <nav className="row" aria-label={t("dive.other")}>
          {data.prevId ? (
            <Link className="button" href={`/dives/${data.prevId}`} aria-label={t("dive.previous", { seq: data.seq - 1 })}>
              ‹ #{data.seq - 1}
            </Link>
          ) : (
            <span className="button" aria-disabled="true">
              ‹
            </span>
          )}
          {data.nextId ? (
            <Link className="button" href={`/dives/${data.nextId}`} aria-label={t("dive.next", { seq: data.seq + 1 })}>
              #{data.seq + 1} ›
            </Link>
          ) : (
            <span className="button" aria-disabled="true">
              ›
            </span>
          )}
        </nav>
      </div>

      <section className="card verdict" aria-label={t("dive.score")}>
        <ScoreRing score={metrics.score} />
        <div style={{ flex: "1 1 320px" }}>
          <p className="headline">{headline(shown, t)}</p>
          <div className="row" style={{ gap: "0.5rem" }}>
            {shown.map((f, i) => (
              <FindingBadge key={`${f.title}${i}`} finding={f} />
            ))}
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="profile-h">
        <h2 id="profile-h">{t("summary.profile")}</h2>
        <ProfileCharts view={data} />
      </section>

      <MetricCards data={data} detailsHref="#details" />

      <DebriefAndFindings data={data} onSaved={reload} />

      <section className="card" id="details" aria-labelledby="details-h">
        <h2 id="details-h">{t("dive.details")}</h2>
        <p className="muted">{t("dive.detailsHelp")}</p>
        <DetailsForm key={JSON.stringify(data.details) + (kit ? "k" : "")} id={data.id} details={data.details} site={data.dive.site} kit={kit} onSaved={reload} />
        {data.tanks.length > 0 && (
          <p className="muted">
            {t("dive.tanks", {
              tanks: data.tanks
                .map(
                  (k) =>
                    `${k.volumeL ? show("volume", k.volumeL) : t("dive.volumeUnknown")}, ${k.startBar !== null ? `${show("pressure", k.startBar)} → ${show("pressure", k.endBar)}` : t("dive.noPressure")}${k.gas ? `, ${k.gas}` : ""}`,
                )
                .join("; "),
            })}
          </p>
        )}
        <p className="muted">
          {t("dive.imported", { file: data.source.fileName, date: formatDate(data.importedAt.slice(0, 19), false, lang) })} · id <code>{data.id}</code>
        </p>
      </section>
    </div>
  );
}
