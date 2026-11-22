import path from "node:path";
import { buildExport } from "../exportFile";
import type { Backend } from "./backends";
import { units } from "./config";
import { DiveStore } from "./diveStore";
import { KitStore } from "./kitStore";
import { envVar } from "./paths";
import { TripStore } from "./tripStore";

/**
 * The phone's file, kept up to date by DiveDeck itself, as TripDeck keeps its trip files: after every
 * change to the dives, trips or kit (by the app or by the companion through the MCP server), the
 * whole log is written to `phone/DiveDeck.divedeck.json` in DiveDeck's folder (on this PC, in
 * OneDrive or in My Drive › DiveDeck). On the phone, open that file from Drive or OneDrive.
 */
export const PHONE_AREA = "phone";
export const PHONE_FILE_NAME = "DiveDeck.divedeck.json";
/** Changes come in bursts (an import, a review saved after the details): one write after they settle. */
export const PHONE_FILE_DELAY_MS = 3000;

/** Where the phone's file is, for people: a path on this PC, or "My Drive › DiveDeck › phone › …". */
export function phoneFileLocation(backend: Backend): string {
  return backend.kind === "google"
    ? `${backend.location} › ${PHONE_AREA} › ${PHONE_FILE_NAME}`
    : path.join(backend.location, PHONE_AREA, PHONE_FILE_NAME);
}

/** Writes the phone's file now, from the log as it is in `backend`. */
export async function writePhoneFile(backend: Backend, now = new Date()): Promise<void> {
  const [dives, trips, kit] = await Promise.all([new DiveStore(backend).list(), new TripStore(backend).list(), new KitStore(backend).get()]);
  const file = buildExport({ dives, trips, kit, units: units() }, now.toISOString());
  await backend.write(PHONE_AREA, PHONE_FILE_NAME, JSON.stringify(file));
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** Writes the phone's file once the changes to this backend settle; a failure only skips this write. */
export function schedulePhoneFile(backend: Backend): void {
  if (envVar("PHONE_FILE") === "off") return;
  const key = `${backend.kind}|${backend.location}`;
  clearTimeout(pending.get(key));
  const timer = setTimeout(() => {
    pending.delete(key);
    writePhoneFile(backend).catch((err: unknown) => console.error(`DiveDeck: the phone's file wasn't written: ${(err as Error).message}`));
  }, PHONE_FILE_DELAY_MS);
  timer.unref?.();
  pending.set(key, timer);
}

/** The backend, telling the phone's file about every change to the dives, trips or kit. */
export function withPhoneFile(backend: Backend): Backend {
  const changed = (area: string) => {
    if (area === "dives" || area === "trips" || area === "kit") schedulePhoneFile(backend);
  };
  return {
    kind: backend.kind,
    location: backend.location,
    list: (area) => backend.list(area),
    read: (area, name) => backend.read(area, name),
    async write(area, name, data) {
      await backend.write(area, name, data);
      changed(area);
    },
    async remove(area, name) {
      await backend.remove(area, name);
      changed(area);
    },
  };
}
