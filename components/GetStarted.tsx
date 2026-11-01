"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/useLang";
import { Command } from "./Command";
import { Icon } from "./Icons";
import { api } from "./useLive";
import { useSettings } from "./useSettings";

const DISMISSED = "divedeck.getStarted.dismissed";
const listeners = new Set<() => void>();

/** Whether the steps were hidden in this browser; hidden on the server, so nothing flashes. */
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

type Storage = { active: "local" | "onedrive" | "google"; location: string };

/**
 * The first steps, on the dashboard until they are done or dismissed: where the log lives, the
 * first dives, and a companion that can reach them. Each step says whether it is done.
 */
export function GetStarted({ dives, onImported }: { dives: number; onImported: () => void }) {
  const { settings } = useSettings();
  const t = useT();
  const [storage, setStorage] = useState<Storage | null>(null);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/storage", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setStorage)
      .catch(() => setStorage(null));
  }, []);

  if (!settings) return null;
  const provider = settings.providers.find((p) => p.id === settings.provider)!;
  const app = settings.provider === "codex" ? settings.apps.codex : settings.apps.claudeCode;
  const connected = provider.usesApi ? !!provider.key : app.runs === "typescript";
  const steps = [true, dives > 0, connected];
  if (dismissed || steps.every(Boolean)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Without storage the steps can't stay hidden; they go once they are done anyway.
    }
    listeners.forEach((l) => l());
  }

  async function samples() {
    setBusy(true);
    try {
      await api("/api/import/samples", "POST");
      onImported();
    } finally {
      setBusy(false);
    }
  }

  const where = storage ? (storage.active === "google" ? storage.location : storage.active === "onedrive" ? t("start.oneDrive") : t("start.thisComputer")) : "…";
  const mark = (done: boolean, n: number) => (
    <span className={`step-mark ${done ? "done" : ""}`} aria-label={done ? t("start.done") : t("start.step", { n })} role="img">
      {done ? Icon.check : n}
    </span>
  );

  return (
    <section className="card get-started" aria-labelledby="start-h">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="start-h" style={{ margin: 0 }}>
          {t("start.title")}
        </h2>
        <button type="button" className="fold-all" onClick={dismiss}>
          {t("start.hide")}
        </button>
      </div>
      <ol className="steps">
        <li>
          {mark(steps[0], 1)}
          <div>
            <strong>{t("start.whereTitle")}</strong>
            <p className="secondary">{rich(t("start.where", { where }), { a: (s) => <Link href="/settings">{s}</Link> })}</p>
          </div>
        </li>
        <li>
          {mark(steps[1], 2)}
          <div>
            <strong>{t("start.firstTitle")}</strong>
            {steps[1] ? (
              <p className="secondary">{t("start.inLog", { n: dives })}</p>
            ) : (
              <div className="row" style={{ marginTop: "0.4rem" }}>
                <Link className="button primary" href="/import">
                  {t("start.importUddf")}
                </Link>
                <button className="button" type="button" disabled={busy} onClick={samples}>
                  {busy ? t("common.loading") : t("start.samples")}
                </button>
              </div>
            )}
          </div>
        </li>
        <li>
          {mark(steps[2], 3)}
          <div>
            <strong>{t("start.companionTitle")}</strong>
            {connected ? (
              <p className="secondary">{provider.usesApi ? t("start.ready", { name: provider.name }) : t("start.connected", { app: provider.app ?? "" })}</p>
            ) : provider.usesApi ? (
              <p className="secondary">{rich(t("start.addKey"), { a: (s) => <Link href="/settings">{s}</Link> })}</p>
            ) : (
              <>
                <p className="secondary">{t("start.connect", { app: provider.app ?? "" })}</p>
                <Command block text={app.commands.join("\n")} />
              </>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
