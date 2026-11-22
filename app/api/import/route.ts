import { ExportFileError } from "@/lib/exportFile";
import { isPhoneDives, readPhoneDives, readPhoneEdits } from "@/lib/phoneDives";
import { countEdits, noEdits, type PhoneEdits } from "@/lib/phoneEdits";
import { DiveStore } from "@/lib/server/diveStore";
import { savePhoneEdits } from "@/lib/server/phoneEdits";
import { assertSameOrigin, handle, HttpError } from "@/lib/server/http";
import { UddfParseError } from "@/lib/uddf";

const MAX_BYTES = 50 * 1024 * 1024;

/** The original files in an upload: a UDDF file as it is, the file from the phone app as the ones it carries, with its changes. */
function originals(name: string, data: Uint8Array): { files: { name: string; data: Uint8Array }[]; edits: PhoneEdits } {
  if (!name.toLowerCase().endsWith(".json")) return { files: [{ name, data }], edits: noEdits() };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new ExportFileError("This .json file isn't valid JSON.");
  }
  if (!isPhoneDives(json)) throw new ExportFileError("This isn't a file from the DiveDeck phone app. On the phone, use Your file → Send to PC.");
  return { files: readPhoneDives(json).map((f) => ({ name: f.fileName, data: f.data })), edits: readPhoneEdits(json) };
}

/** Uploads one or more .uddf files, or the file the phone app sends (multipart form, field "files"). */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Send the files as a multipart form.");
  });
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No files in the upload.");
  const store = new DiveStore();
  const results = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      results.push({ file: file.name, error: "The file is larger than 50 MB." });
      continue;
    }
    let found;
    try {
      found = originals(file.name, new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      if (!(err instanceof ExportFileError)) throw err;
      results.push({ file: file.name, error: err.message });
      continue;
    }
    const hasEdits = countEdits(found.edits) > 0;
    if (!found.files.length && !hasEdits) results.push({ file: file.name, error: "No dives in this file." });
    for (const { name, data } of found.files) {
      const label = name === file.name ? name : `${name} (from the phone)`;
      try {
        const r = await store.importFile(name, data);
        results.push({ file: label, added: r.added.length, duplicates: r.duplicates.length });
      } catch (err) {
        if (!(err instanceof UddfParseError)) throw err;
        results.push({ file: label, error: err.message });
      }
    }
    if (hasEdits) {
      const saved = await savePhoneEdits(found.edits, store);
      results.push({ file: `${file.name} (changes from the phone)`, dives: saved.dives, todos: saved.todos, skipped: saved.skipped });
    }
  }
  return { results };
});
