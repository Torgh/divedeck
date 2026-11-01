"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/components/useLive";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/useLang";
import type { LogView } from "@/lib/views";

type Result = { file: string; added?: number; duplicates?: number; error?: string };

/** What the import did, file by file, and where to go next. */
function ImportSummary({ results, after }: { results: Result[]; after: { dives: number; toSortOut: number } | null }) {
  const added = results.reduce((n, r) => n + (r.added ?? 0), 0);
  const known = results.reduce((n, r) => n + (r.duplicates ?? 0), 0);
  const failed = results.filter((r) => r.error).length;
  const t = useT();
  return (
    <section className="card import-summary" aria-live="polite" aria-labelledby="imported-h">
      <h2 id="imported-h" style={{ margin: 0 }}>
        {t("import.imported")}
      </h2>
      <div>
        <span className="big">{t("import.newDives", { n: added })}</span>
        <span className="muted">
          {known ? ` · ${t("import.known", { n: known })}` : ""}
          {failed ? ` · ${t("import.failed", { n: failed })}` : ""}
        </span>
      </div>
      <ul>
        {results.map((r) => (
          <li key={r.file}>
            <span className={`severity ${r.error ? "critical" : "good"}`} role="img" aria-label={r.error ? t("import.fileFailed") : t("import.fileRead")}>
              {r.error ? Icon.stop : Icon.check}
            </span>
            <span>
              {r.file}: {r.error ? <span style={{ color: "var(--critical)" }}>{r.error}</span> : t("import.fileResult", { added: r.added ?? 0, n: r.duplicates ?? 0 })}
            </span>
          </li>
        ))}
      </ul>
      {after && after.toSortOut > 0 && (
        <div className="notice">
          {t("import.toSortOut", { count: after.toSortOut, n: after.dives })}
        </div>
      )}
      <div className="row">
        {after && after.toSortOut > 0 && (
          <Link className="button primary" href="/">
            {t("import.sortOut")}
          </Link>
        )}
        <Link className="button" href="/dives">
          {t("sure.openLog")}
        </Link>
      </div>
    </section>
  );
}

export default function ImportPage() {
  const t = useT();
  const [results, setResults] = useState<Result[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [python, setPython] = useState<{ database: string; available: boolean } | null>(null);
  /** The log after an import: how many dives, and how many of them miss something. */
  const [after, setAfter] = useState<{ dives: number; toSortOut: number } | null>(null);

  async function refreshLog() {
    try {
      const res = await fetch("/api/dives", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const log: LogView = await res.json();
      setAfter({ dives: log.dives.length, toSortOut: new Set(log.todos.flatMap((todo) => todo.dives)).size });
    } catch {
      setAfter(null);
    }
  }

  useEffect(() => {
    fetch("/api/migrate")
      .then((r) => r.json())
      .then(setPython)
      .catch(() => setPython(null));
  }, []);

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResults(body.results);
      await refreshLog();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run(what: "samples" | "migrate") {
    setBusy(true);
    setMessage(null);
    try {
      if (what === "samples") {
        const { added } = await api<{ added: number }>("/api/import/samples", "POST");
        setMessage(added ? t("import.samplesLoaded", { n: added }) : t("import.samplesThere"));
      } else {
        const r = await api<{ added: number; alreadyThere: number; reviews: number; failed: { fileName: string }[] }>("/api/migrate", "POST");
        setMessage(
          t("import.migrated", { added: r.added, reviews: r.reviews, there: r.alreadyThere }) +
            (r.failed.length ? `; ${t("import.unreadable", { files: r.failed.map((f) => f.fileName).join(", ") })}` : "."),
        );
      }
      await refreshLog();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void upload(e.dataTransfer.files);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t("log.import")}</h1>
      </div>
      <div
        className={`card dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <p>
          {t("import.drop")}
        </p>
        <label className="button primary">
          {busy ? t("import.importing") : t("import.choose")}
          <input type="file" accept=".uddf,.xml,.json" multiple hidden disabled={busy} onChange={(e) => e.target.files && upload(e.target.files)} />
        </label>
        <p className="muted">{t("import.skipped")}</p>
      </div>

      {results && <ImportSummary results={results} after={after} />}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}

      <div className="grid cols-2">
        {python?.available && (
          <div className="card">
            <h2>{t("import.pythonTitle")}</h2>
            <p className="secondary">{rich(t("import.python", { database: python.database }), { code: (s) => <code>{s}</code> })}</p>
            <button className="button" disabled={busy} onClick={() => run("migrate")}>
              {t("import.copyOld")}
            </button>
          </div>
        )}
        <div className="card">
          <h2>{t("import.noComputer")}</h2>
          <p className="secondary">{t("import.samplesHelp")}</p>
          <button className="button" disabled={busy} onClick={() => run("samples")}>
            {t("start.samples")}
          </button>
        </div>
      </div>
    </div>
  );
}
