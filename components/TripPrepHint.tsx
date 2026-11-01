"use client";

import { useT } from "@/lib/i18n/useLang";
import { Command } from "./Command";

/** How a trip gets here: your companion copies it from TripDeck. */
export function TripPrepHint({ trip }: { trip?: string }) {
  const t = useT();
  return (
    <p className="muted">
      {trip ? t("tripHint.ask") : t("tripHint.plan")} <Command text={`/mcp__divedeck__trip-prep ${trip ?? t("tripHint.tripName")}`} />.{" "}
      {trip ? t("tripHint.again") : t("tripHint.appear")}
    </p>
  );
}
