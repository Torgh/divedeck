import { App as NativeApp } from "@capacitor/app";
import { useEffect, useMemo, useRef, useState } from "react";
import { Glyph } from "@/components/NavIcons";
import { UnitsProvider } from "@/components/Units";
import { type DiveDeckExport, readExport } from "@/lib/exportFile";
import { formatDate } from "@/lib/format";
import type { Key } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/useLang";
import { buildPhoneDives, isPhoneDives, type PhoneFile, phoneDivesFileName, phoneFile, stillOnPhone, withPhoneDives } from "@/lib/phoneDives";
import { tripsView } from "@/lib/tripViews";
import { logView } from "@/lib/views";
import { DiveScreen, FileScreen, GearScreen, Home, localTime, LogScreen, TripScreen, TripsScreen, Welcome } from "./screens";
import { shareFile } from "./share";
import { forgetLog, loadLog, loadPhoneFiles, saveLog, savePhoneFiles } from "./storage";
import { go, useHashPath } from "./useHashPath";

const TABS: { href: string; label: Key; icon: string }[] = [
  { href: "/", label: "nav.dashboard", icon: "dashboard" },
  { href: "/dives", label: "nav.log", icon: "log" },
  { href: "/trips", label: "nav.trips", icon: "trips" },
  { href: "/gear", label: "nav.gear", icon: "gear" },
  { href: "/file", label: "phone.yourFile", icon: "import" },
];

export function App() {
  // undefined while the stored log is read, null when nothing is imported yet.
  const [log, setLog] = useState<DiveDeckExport | null | undefined>(undefined);
  // UDDF files imported on the phone, shown with the log until an export from the PC holds them.
  const [phoneFiles, setPhoneFiles] = useState<PhoneFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Re-read on resume so "in 3 days" moves on when the app was left open overnight.
  const [now, setNow] = useState(() => new Date());
  const path = useHashPath();
  const t = useT();
  const lang = useLang();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([loadLog(), loadPhoneFiles()]).then(([stored, files]) => {
      setPhoneFiles(files);
      setLog(stored);
    });
  }, []);

  // Android back button: back through the screens opened, out of the app from the dashboard.
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  useEffect(() => {
    const back = NativeApp.addListener("backButton", () => {
      if (pathRef.current === "/") void NativeApp.exitApp();
      else history.back();
    });
    const resume = NativeApp.addListener("resume", () => setNow(new Date()));
    return () => {
      void back.then((h) => h.remove());
      void resume.then((h) => h.remove());
    };
  }, []);

  // A new screen starts at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  // Links within a screen ("#card-…", "#todos") scroll to it instead of changing the screen.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const href = (e.target as Element).closest?.("a")?.getAttribute("href");
      if (!href?.startsWith("#") || href.startsWith("#/")) return;
      e.preventDefault();
      document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const merged = useMemo(() => (log ? withPhoneDives(log.dives, phoneFiles) : null), [log, phoneFiles]);
  const views = useMemo(() => (log && merged ? { log: logView(merged.dives, lang), trips: tripsView(log.trips, now) } : null), [log, merged, now, lang]);

  // One picker for both: the export from the PC (JSON), or a UDDF file from the dive computer's app.
  async function importFile(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = new TextDecoder().decode(bytes);
      if (text.trimStart().startsWith("{")) {
        const json = JSON.parse(text);
        if (isPhoneDives(json)) throw new Error(t("phone.forPc"));
        const next = readExport(json);
        const kept = stillOnPhone(phoneFiles, next.dives);
        await saveLog(next);
        await savePhoneFiles(kept);
        setLog(next);
        setPhoneFiles(kept);
        setNotice(t("phone.imported", { dives: t("log.count", { n: next.dives.length }), trips: t("phone.trips", { n: next.trips.length }) }));
        go("/");
        return;
      }
      if (!log || !merged) throw new Error(t("phone.pcFirst"));
      const { file: added, records } = phoneFile(file.name, bytes, new Date().toISOString());
      const known = new Set(merged.dives.map((d) => d.id));
      const fresh = records.filter((r) => !known.has(r.id));
      if (!fresh.length) {
        setNotice(records.length ? t("phone.already") : t("phone.noDivesInFile"));
        return;
      }
      const files = [...phoneFiles, added];
      await savePhoneFiles(files);
      setPhoneFiles(files);
      setNotice(t("phone.added", { n: fresh.length }));
      go(fresh.length === 1 ? `/dives/${fresh[0].id}` : "/dives");
    } catch (e) {
      setNotice(e instanceof SyntaxError ? t("phone.badJson") : (e as Error).message);
    }
  }

  async function sendToPc() {
    const at = new Date().toISOString();
    try {
      await shareFile(phoneDivesFileName(at), JSON.stringify(buildPhoneDives(phoneFiles, at)));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  async function forget() {
    if (merged?.phoneOnly.size && !window.confirm(t("phone.confirmForget", { n: merged.phoneOnly.size }))) return;
    await forgetLog();
    setLog(null);
    setPhoneFiles([]);
    go("/");
  }

  if (log === undefined) return <div className="splash" />;
  const pickFile = () => fileInput.current?.click();
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  let screen: React.ReactNode;
  if (!log || !views || !merged) screen = <Welcome onImport={pickFile} />;
  else if (path.startsWith("/dives/")) {
    const id = decodeURIComponent(path.slice("/dives/".length));
    screen = <DiveScreen records={merged.dives} id={id} onPhone={merged.phoneOnly.has(id)} />;
  }
  else if (path === "/dives") screen = <LogScreen log={views.log} />;
  else if (path.startsWith("/trips/")) screen = <TripScreen plans={log.trips} records={merged.dives} id={decodeURIComponent(path.slice("/trips/".length))} now={now} />;
  else if (path === "/trips") screen = <TripsScreen trips={views.trips.trips} />;
  else if (path === "/gear") screen = <GearScreen kit={log.kit} records={merged.dives} />;
  else if (path === "/file") screen = <FileScreen log={log} onPhone={merged.phoneOnly.size} onImport={pickFile} onSend={sendToPc} onForget={forget} />;
  else screen = <Home log={views.log} next={views.trips.next} onPhone={merged.phoneOnly.size} />;

  return (
    <UnitsProvider fixed={log?.units ?? "metric"}>
      <div className="app">
        <header className="topbar">
          <a href="#/" className="brand">
            <img src="./icon.svg" alt="" width={32} height={32} />
            DiveDeck
          </a>
          {log && (
            <div className="live">
              <span className="status">
                <span className="dot good" />
                <strong>{t("nav.offline")}</strong>
              </span>
              <span>{t("phone.exported", { date: formatDate(localTime(log.exportedAt), false, lang) })}</span>
            </div>
          )}
        </header>
        {log && (
          <nav className="nav" aria-label={t("nav.main")}>
            {TABS.map((tab) => (
              <a key={tab.href} href={`#${tab.href}`} className="link" aria-current={current(tab.href) ? "page" : undefined}>
                <Glyph icon={tab.icon} />
                {t(tab.label)}
              </a>
            ))}
          </nav>
        )}
        <main className="page">{screen}</main>
      </div>
      {/* No `accept`: cloud apps often hand over .divedeck.json files without a JSON type. */}
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </UnitsProvider>
  );
}
