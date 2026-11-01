"use client";

import Link from "next/link";
import { DiveList } from "@/components/DiveList";
import { useLive } from "@/components/useLive";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/useLang";
import type { LogView } from "@/lib/views";

type Data = LogView & { version: string; dataFolder: string };

export default function DiveLog() {
  const { data, error, loading } = useLive<Data>("/api/dives");
  const t = useT();
  if (error && !data) return <div className="error">{t("log.loadFailed", { error })}</div>;
  if (!data) return <p className="muted">{t("log.loading")}</p>;

  return (
    <div className={`stack ${loading ? "loading" : ""}`} style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("nav.log")}</h1>
        <Link className="button primary" href="/import">
          {t("log.import")}
        </Link>
      </div>
      {!data.dives.length ? (
        <div className="notice">
          {rich(t("log.empty"), { a: (s) => <Link href="/import">{s}</Link> })}
        </div>
      ) : (
        <>
          <DiveList log={data} />
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            {t("log.count", { n: data.dives.length })} · {data.dataFolder}
          </p>
        </>
      )}
    </div>
  );
}
