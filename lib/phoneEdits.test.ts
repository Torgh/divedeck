import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint } from "./dive";
import { buildPhoneDives, readPhoneDives, readPhoneEdits } from "./phoneDives";
import {
  applyDiveEdits,
  applyTripEdits,
  countEdits,
  noEdits,
  pendingEdits,
  readEdits,
  withDetailsChange,
  withTodo,
} from "./phoneEdits";
import { newRecord } from "./record";
import type { TripPlan } from "./trip";
import { parseUddf } from "./uddf";

const ROOT = path.resolve(__dirname, "..");
const [dive] = parseUddf(new Uint8Array(fs.readFileSync(path.join(ROOT, "examples", "spring-2026.uddf"))));
const record = newRecord(fingerprint(dive), dive, "spring.uddf", "0".repeat(64), "2026-11-01T10:00:00.000Z");
const AT = "2026-11-22T10:00:00.000Z";
const trip = {
  id: "dahab",
  name: "Dahab",
  dives: [],
  todos: [
    { id: "t1", text: "Ask the shop about nitrox", by: "companion", done: false, createdAt: AT },
    { id: "t2", text: "Service the regulator", by: "diver", done: true, doneAt: AT, createdAt: AT },
  ],
} as unknown as TripPlan;

describe("changes made on the phone", () => {
  it("fill in a dive's details over the export, merged with earlier changes", () => {
    let edits = withDetailsChange(noEdits(), record.id, { site: " Koparki ", tankVolumeL: 15 }, AT);
    edits = withDetailsChange(edits, record.id, { buddy: "Ola", gas: "EAN32" }, AT);
    const [changed] = applyDiveEdits([record], edits);
    expect(changed.details).toEqual({ site: "Koparki", tankVolumeL: 15, buddy: "Ola", gas: { o2: 0.32, he: 0 } });
    expect(countEdits(edits)).toBe(1);
  });

  it("remove a field with an empty text, and refuse a gas they can't read", () => {
    const filled = { ...record, details: { site: "Koparki", buddy: "Ola" } };
    const [changed] = applyDiveEdits([filled], withDetailsChange(noEdits(), record.id, { buddy: "" }, AT));
    expect(changed.details).toEqual({ site: "Koparki" });
    expect(() => withDetailsChange(noEdits(), record.id, { gas: "mystery" }, AT)).toThrow(/Can't read the gas/);
  });

  it("tick to-dos off and back on", () => {
    let edits = withTodo(noEdits(), "dahab", "t1", true, AT);
    edits = withTodo(edits, "dahab", "t2", false, AT);
    const [changed] = applyTripEdits([trip], edits);
    expect(changed.todos).toEqual([
      { ...trip.todos![0], done: true, doneAt: AT },
      { id: "t2", text: "Service the regulator", by: "diver", done: false, createdAt: AT },
    ]);
  });

  it("are forgotten once an export holds them, and kept until then", () => {
    let edits = withDetailsChange(noEdits(), record.id, { site: "Koparki" }, AT);
    edits = withDetailsChange(edits, "only-on-phone", { site: "Deepspot" }, AT);
    edits = withTodo(edits, "dahab", "t1", true, AT);
    const before = pendingEdits(edits, [record], [trip]);
    expect(countEdits(before)).toBe(3);
    const newer = { ...record, details: { site: "Koparki" } };
    const newerTrip = { ...trip, todos: [{ ...trip.todos![0], done: true }, trip.todos![1]] } as TripPlan;
    const after = pendingEdits(edits, [newer], [newerTrip]);
    expect(Object.keys(after.details)).toEqual(["only-on-phone"]);
    expect(after.todos).toEqual({});
  });

  it("travel to the PC in the phone's file, and read back as they were", () => {
    const edits = withTodo(withDetailsChange(noEdits(), record.id, { weighting: "heavy", ballastKg: 2 }, AT), "dahab", "t1", true, AT);
    const file = JSON.parse(JSON.stringify(buildPhoneDives([], AT, edits)));
    expect(file.version).toBe(2);
    expect(readPhoneDives(file)).toEqual([]);
    expect(readPhoneEdits(file)).toEqual(edits);
    expect(buildPhoneDives([], AT, noEdits())).not.toHaveProperty("edits");
    expect(readEdits({ details: { x: { change: "nope" } }, todos: { t: { a: { done: "yes" } } } })).toEqual(noEdits());
  });
});
