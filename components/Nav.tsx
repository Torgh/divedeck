"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Key, T } from "@/lib/i18n";
import { useT } from "@/lib/i18n/useLang";
import { Glyph } from "./NavIcons";
import { useKeptCopy } from "./Offline";

/** On a phone the first ones are the tab bar; the rest open from More. */
const LINKS: { href: string; label: Key; icon: string }[] = [
  { href: "/", label: "nav.dashboard", icon: "dashboard" },
  { href: "/dives", label: "nav.log", icon: "log" },
  { href: "/trips", label: "nav.trips", icon: "trips" },
  { href: "/gear", label: "nav.gear", icon: "gear" },
];
const MORE_LINKS: typeof LINKS = [
  { href: "/import", label: "nav.import", icon: "import" },
  { href: "/companion", label: "nav.companion", icon: "companion" },
  { href: "/settings", label: "nav.settings", icon: "settings" },
];

type Storage = { active: "local" | "onedrive" | "google"; location: string };

/** Where the log is kept, short enough for the menu; the full place is in the tooltip. */
function storageLabel(s: Storage, t: T) {
  if (s.active === "google") return s.location;
  return s.active === "onedrive" ? "OneDrive" : t("nav.thisComputer");
}

export function Nav() {
  const t = useT();
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const [storage, setStorage] = useState<Storage | null>(null);
  const kept = useKeptCopy();
  // More stays open on the page it was opened on; going to another page closes it.
  const [moreOn, setMoreOn] = useState<string | null>(null);
  const moreOpen = moreOn === path;
  const inMore = MORE_LINKS.some((l) => current(l.href));

  useEffect(() => {
    fetch("/api/storage", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setStorage)
      .catch(() => setStorage(null));
  }, []);

  const brand = (
    <Link href="/" className="brand">
      {/* A small static SVG: next/image would not optimise it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-small.svg" alt="" width={32} height={32} />
      DiveDeck
    </Link>
  );
  const live = (
    <div className={`live ${kept ? "offline" : ""}`} title={kept ? t("nav.offlineTitle") : t("nav.liveTitle")}>
      <span className="status">
        <span className={`dot ${kept ? "warning" : "good"}`} />
        <strong>{kept ? t("nav.offline") : t("nav.live")}</strong>
      </span>
      {storage && <span title={storage.location}>{storageLabel(storage, t)}</span>}
    </div>
  );
  const link = (l: (typeof LINKS)[number]) => (
    <Link key={l.href} href={l.href} className="link" aria-current={current(l.href) ? "page" : undefined}>
      <Glyph icon={l.icon} />
      {t(l.label)}
    </Link>
  );

  return (
    <>
      {/* On a phone: the brand and the live status on top, the menu as a tab bar at the bottom. */}
      <header className="topbar">
        {brand}
        {live}
      </header>
      <nav className={`nav ${moreOpen ? "more-open" : ""}`} aria-label={t("nav.main")}>
        {brand}
        {LINKS.map(link)}
        <button
          type="button"
          className="link more"
          aria-expanded={moreOpen}
          aria-controls="more-links"
          aria-current={inMore && !moreOpen ? "page" : undefined}
          onClick={() => setMoreOn(moreOpen ? null : path)}
        >
          <Glyph icon="more" />
          {t("nav.more")}
        </button>
        <div className="more-links" id="more-links">
          {MORE_LINKS.map(link)}
        </div>
        {live}
      </nav>
    </>
  );
}
