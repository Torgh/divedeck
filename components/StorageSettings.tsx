"use client";

import { useEffect, useState } from "react";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/useLang";
import { api } from "./useLive";
import { Command } from "./Command";

interface StorageView {
  active: "local" | "onedrive" | "google";
  chosen: string;
  location: string;
  local: { folder: string };
  onedrive: { folder: string | null; configuredFolder: string | null };
  google: { clientConfigured: boolean; clientId: string | null; account: string | null; expired?: boolean };
  copied?: number;
}

/** Where the dive log is stored: this PC, the OneDrive folder, or Google Drive. */
export function StorageSettings() {
  const t = useT();
  const [view, setView] = useState<StorageView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState("");
  const [client, setClient] = useState({ id: "", secret: "" });

  useEffect(() => {
    let alive = true;
    fetch("/api/storage", { cache: "no-store" })
      .then((r) => r.json())
      .then((v: StorageView) => {
        if (!alive) return;
        setView(v);
        // Back from the Google sign-in.
        const params = new URLSearchParams(window.location.search);
        if (params.get("google") === "connected") setMessage(t("storage.googleConnected", { n: Number(params.get("copied") ?? 0) }));
        if (params.get("google") === "error") setMessage(`⛔ ${params.get("message") ?? t("storage.googleFailed")}`);
      })
      .catch((err: Error) => alive && setMessage(`⛔ ${err.message}`));
    return () => {
      alive = false;
    };
    // Read once, when the page opens: a language change doesn't repeat the message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(body: object, done: (v: StorageView) => string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await api<StorageView>("/api/storage", "POST", body);
      setView(next);
      setMessage(done(next));
    } catch (err) {
      setMessage(`⛔ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!view) return null;
  const copied = (v: StorageView) => (v.copied ? ` ${t("storage.copied", { n: v.copied })}` : "");
  const choose = (storage: StorageView["active"]) => post({ storage }, (v) => `${t("storage.nowIn", { location: v.location })}${copied(v)}`);

  return (
    <div className="card stack" id="storage">
      <h2>{t("storage.title")}</h2>
      <p className="secondary">{rich(t("storage.intro", { location: view.location }), { code: (s) => <code>{s}</code> })}</p>

      <label className="row" style={{ gap: "0.5rem" }}>
        <input type="radio" name="storage" checked={view.active === "local"} disabled={busy} onChange={() => choose("local")} />
        <span>
          {t("storage.thisPc")} <span className="muted">· {view.local.folder}</span>
        </span>
      </label>

      <div className="stack" style={{ gap: "0.4rem" }}>
        <label className="row" style={{ gap: "0.5rem" }}>
          <input type="radio" name="storage" checked={view.active === "onedrive"} disabled={busy || !view.onedrive.folder} onChange={() => choose("onedrive")} />
          <span>
            OneDrive{" "}
            <span className="muted">
              · {view.onedrive.folder ? t("storage.oneDriveFound", { folder: view.onedrive.folder }) : t("storage.oneDriveMissing")}
            </span>
          </span>
        </label>
        <div className="row" style={{ paddingLeft: "1.6rem" }}>
          <input
            className="button"
            style={{ minWidth: "18rem", cursor: "text" }}
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={view.onedrive.configuredFolder ?? t("storage.oneDrivePlaceholder")}
          />
          <button className="button" disabled={busy || !folder.trim()} onClick={() => post({ oneDriveFolder: folder }, (v) => (v.onedrive.folder ? t("storage.folderSaved") : `⛔ ${t("storage.noFolder")}`))}>
            {t("storage.saveFolder")}
          </button>
        </div>
      </div>

      <div className="stack" style={{ gap: "0.4rem" }}>
        <label className="row" style={{ gap: "0.5rem" }}>
          <input type="radio" name="storage" checked={view.active === "google"} disabled={busy || view.google.account === null} onChange={() => choose("google")} />
          <span>
            Google Drive{" "}
            <span className="muted">
              · {view.google.account !== null ? `${t("storage.myDrive")}${view.google.account ? `, ${view.google.account}` : ""}` : t("storage.notConnected")}
            </span>
          </span>
        </label>
        <div className="stack" style={{ paddingLeft: "1.6rem", gap: "0.4rem" }}>
          {view.google.account !== null && view.google.expired && (
            <p role="alert" style={{ margin: 0, color: "var(--critical)" }}>
              ⚠️ {t("storage.expired")}
            </p>
          )}
          {view.google.account !== null ? (
            <div className="row" style={{ gap: "0.5rem" }}>
              {/* Signing in again replaces the saved access; the dives stay where they are. */}
              <a className={`button ${view.google.expired ? "primary" : ""}`} style={{ textDecoration: "none" }} href="/api/auth/google/start">
                {t("storage.reconnect")}
              </a>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api<{ copied: number }>("/api/auth/google/disconnect", "POST");
                    setMessage(`${t("storage.disconnected")}${r.copied ? ` ${t("storage.copiedBack", { n: r.copied })}` : ""}`);
                    setView(await (await fetch("/api/storage", { cache: "no-store" })).json());
                  } catch (err) {
                    setMessage(`⛔ ${(err as Error).message}`);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("storage.disconnect")}
              </button>
            </div>
          ) : view.google.clientConfigured ? (
            <a className="button primary" style={{ alignSelf: "start", textDecoration: "none" }} href="/api/auth/google/start">
              {t("storage.connect")}
            </a>
          ) : (
            <>
              <p className="muted" style={{ margin: 0 }}>
                {rich(t("storage.oauthHelp"), { uri: () => <Command text="http://localhost:3001/api/auth/google/callback" /> })}
              </p>
              <div className="form">
                <label>
                  {t("storage.clientId")}
                  <input value={client.id} onChange={(e) => setClient({ ...client, id: e.target.value })} />
                </label>
                <label>
                  {t("storage.clientSecret")}
                  <input type="password" autoComplete="off" value={client.secret} onChange={(e) => setClient({ ...client, secret: e.target.value })} />
                </label>
              </div>
              <button
                className="button"
                style={{ alignSelf: "start" }}
                disabled={busy || !client.id.trim() || !client.secret.trim()}
                onClick={() => post({ googleClientId: client.id, googleClientSecret: client.secret }, () => t("storage.clientSaved"))}
              >
                {t("storage.saveClient")}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <p className="secondary" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
