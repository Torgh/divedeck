"use client";

import { useState } from "react";
import { LanguagePicker } from "@/components/LanguagePicker";
import { StorageSettings } from "@/components/StorageSettings";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/useLang";
import { useUnits } from "@/components/Units";
import type { UnitSystem } from "@/lib/measure";
import { type ProviderView, useSettings } from "@/components/useSettings";
import { api } from "@/components/useLive";
import type { AppStatus } from "@/lib/server/agentApps";
import { Command } from "@/components/Command";

function Commands({ status }: { status: AppStatus }) {
  const t = useT();
  const name = status.app === "claude-code" ? "Claude Code" : "Codex";
  if (status.runs === "typescript") return <p className="secondary">✅ {t("settings.connected", { name })}</p>;
  return (
    <div className="stack" style={{ gap: "0.4rem" }}>
      <p className="secondary">
        {status.runs === "python"
          ? `⚠️ ${t("settings.python", { name })}`
          : status.registered
            ? `⚠️ ${t("settings.otherServer", { name })}`
            : t("settings.connectOnce", { name })}
      </p>
      <Command block text={status.commands.join("\n")} />
      <p className="muted">{t("settings.restart", { name })}</p>
    </div>
  );
}

function ApiProvider({ p, onSave }: { p: ProviderView; onSave: (patch: object) => Promise<unknown> }) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(p.model);
  const [models, setModels] = useState<string[]>(p.models);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
    } catch (err) {
      setMessage(`⛔ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <label className="wide">
        {t("settings.apiKey")}{" "}
        {p.key ? `(${p.key.source === "saved" ? t("settings.keySaved") : t("settings.keyFrom", { source: p.key.source })}: ${p.key.masked})` : `(${t("settings.noKey")})`}
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={p.key ? t("settings.replaceKey") : t("settings.pasteKey")}
        />
      </label>
      <div className="row wide">
        <button className="button primary" disabled={busy || !key.trim()} onClick={() => run(() => onSave({ key: { provider: p.id, value: key } }).then(() => setKey("")), t("settings.keySavedMsg"))}>
          {t("settings.saveKey")}
        </button>
        {p.key?.source === "saved" && (
          <button className="button" disabled={busy} onClick={() => run(() => onSave({ key: { provider: p.id, value: null } }), t("settings.keyRemoved"))}>
            {t("settings.removeKey")}
          </button>
        )}
        <a href={p.keyUrl} target="_blank" rel="noreferrer">
          {t("settings.getKey")}
        </a>
      </div>
      <label>
        {t("settings.model")}
        <input list={`models-${p.id}`} value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id={`models-${p.id}`}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <div className="row" style={{ alignSelf: "end" }}>
        <button className="button" disabled={busy || !model.trim()} onClick={() => run(() => onSave({ provider: p.id, model }), t("settings.modelSet", { model }))}>
          {t("settings.useModel")}
        </button>
        <button
          className="button"
          disabled={busy || !p.key}
          onClick={() =>
            run(async () => {
              const { models: list } = await api<{ models: string[] }>("/api/settings/models", "POST", { provider: p.id });
              setModels(list);
            }, t("settings.modelsLoaded"))
          }
        >
          {t("settings.loadModels")}
        </button>
      </div>
      {message && (
        <p className="wide secondary" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

/** Metric or imperial for everything the pages show; the log itself stays metric. */
function UnitsSettings() {
  const { system, setSystem } = useUnits();
  const t = useT();
  const [failure, setFailure] = useState<string | null>(null);
  const choose = (next: UnitSystem) => setSystem(next).then(() => setFailure(null), (err: Error) => setFailure(err.message));
  return (
    <div className="card stack">
      <h2>{t("settings.units")}</h2>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: "0.4rem" }}>
        <legend className="muted">{t("settings.unitsHow")}</legend>
        <label className="row" style={{ gap: "0.5rem" }}>
          <input type="radio" name="units" checked={system === "metric"} onChange={() => choose("metric")} />
          {t("settings.metric")}
        </label>
        <label className="row" style={{ gap: "0.5rem" }}>
          <input type="radio" name="units" checked={system === "imperial"} onChange={() => choose("imperial")} />
          {t("settings.imperial")}
        </label>
      </fieldset>
      <p className="muted" style={{ margin: 0 }}>
        {t("settings.unitsNote")}
      </p>
      {failure && <div className="error">{failure}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, error, save } = useSettings();
  const [installed, setInstalled] = useState<string | null>(null);
  const t = useT();
  if (error) return <div className="error">{error}</div>;
  if (!settings) return <p className="muted">{t("settings.loading")}</p>;
  const active = settings.providers.find((p) => p.id === settings.provider)!;

  return (
    <div className="stack">
      <h1>{t("nav.settings")}</h1>
      <LanguagePicker />
      <div className="card stack">
        <h2>{t("settings.companion")}</h2>
        <p className="secondary">{t("settings.companionIntro")}</p>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: "0.4rem" }}>
          <legend className="muted">{t("settings.howRun")}</legend>
          {settings.providers.map((p) => (
            <label key={p.id} className="row" style={{ gap: "0.5rem" }}>
              <input type="radio" name="provider" checked={p.id === settings.provider} onChange={() => save({ provider: p.id })} />
              <span>
                {p.name}
                <span className="muted"> · {p.usesApi ? t("companion.billed") : t("settings.noCost")}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="card stack">
        <h2>{active.name}</h2>
        {active.usesApi ? (
          <ApiProvider key={active.id} p={active} onSave={save} />
        ) : (
          <>
            <Commands status={active.id === "claude-code" ? settings.apps.claudeCode : settings.apps.codex} />
            {active.id === "claude-code" && (
              <div className="row">
                {settings.apps.claudeCode.reviewCommandInstalled ? (
                  <span className="secondary">✅ {t("settings.commandInstalled")}</span>
                ) : (
                  <button
                    className="button"
                    onClick={() =>
                      api("/api/settings/review-command", "POST")
                        .then(() => setInstalled(t("settings.installedMsg")))
                        .catch((err: Error) => setInstalled(`⛔ ${err.message}`))
                    }
                  >
                    {t("settings.install")}
                  </button>
                )}
                {installed && <span className="secondary">{installed}</span>}
              </div>
            )}
            <p className="muted">
              {rich(t("settings.thenAsk", { app: active.app ?? "" }), { cmd: () => <Command text="/mcp__divedeck__dive-review" /> })}
            </p>
          </>
        )}
      </div>

      <UnitsSettings />
      <StorageSettings />

      <div className="card stack">
        <h2>{t("settings.phone")}</h2>
        <p className="secondary" style={{ margin: 0 }}>
          {t("settings.phoneHelp")}
        </p>
        <div className="row">
          <a className="button primary" href="/api/export" download>
            {t("settings.export")}
          </a>
        </div>
      </div>

      <div className="card">
        <h2>{t("settings.computer")}</h2>
        <p className="secondary">
          {t("settings.configPath")} <code>{settings.configPath}</code>
          <br />
          {t("settings.dataFolder")} <code>{settings.dataFolder}</code>
        </p>
      </div>
    </div>
  );
}
