import { buildExport, exportFileName } from "@/lib/exportFile";
import { units } from "@/lib/server/config";
import { DiveStore } from "@/lib/server/diveStore";
import { activeBackend } from "@/lib/server/backends";
import { assertLocal, assertSameOrigin, handle } from "@/lib/server/http";
import { KitStore } from "@/lib/server/kitStore";
import { phoneFileLocation, writePhoneFile } from "@/lib/server/phoneFile";
import { TripStore } from "@/lib/server/tripStore";

/** The whole log as one `.divedeck.json` file to download, for the phone app. */
export const GET = handle(async (req) => {
  assertLocal(req);
  const [dives, trips, kit] = await Promise.all([new DiveStore().list(), new TripStore().list(), new KitStore().get()]);
  const now = new Date().toISOString();
  return new Response(JSON.stringify(buildExport({ dives, trips, kit, units: units() }, now)), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(now)}"`,
      "cache-control": "no-store",
    },
  });
});

/** Writes the phone's file in DiveDeck's folder now, instead of after the next change. */
export const POST = handle(async (req) => {
  assertLocal(req);
  assertSameOrigin(req);
  const backend = activeBackend();
  await writePhoneFile(backend);
  return { written: phoneFileLocation(backend) };
});
