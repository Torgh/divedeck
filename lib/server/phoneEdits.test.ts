import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { noEdits, withDetailsChange, withTodo } from "../phoneEdits";
import { addTodo } from "../trip";
import { DiveStore } from "./diveStore";
import { savePhoneEdits } from "./phoneEdits";
import { TripStore } from "./tripStore";
import { isolateEnv, restoreEnv } from "../../test-env";

const ROOT = path.resolve(__dirname, "..", "..");
const SPRING = new Uint8Array(fs.readFileSync(path.join(ROOT, "examples", "spring-2026.uddf")));
const AT = "2026-11-22T10:00:00.000Z";
const saved = { ...process.env };
let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "adm-phone-edits-"));
  for (const name of Object.keys(process.env)) if (/^ONEDRIVE/i.test(name)) delete process.env[name];
  isolateEnv(home);
});

afterEach(() => {
  restoreEnv(saved);
  fs.rmSync(home, { recursive: true, force: true });
});

describe("savePhoneEdits", () => {
  it("saves the details and ticks sent from the phone, and says what it skipped", async () => {
    const dives = new DiveStore();
    const { added } = await dives.importFile("spring.uddf", SPRING);
    const trips = new TripStore();
    await trips.save({ id: "dahab", name: "Dahab", dives: [] });
    let todoId = "";
    await trips.update("dahab", (p) => {
      todoId = addTodo(p, "Ask about nitrox", undefined, AT).id;
    });

    let edits = withDetailsChange(noEdits(), added[0], { site: "Koparki", gas: "EAN32", gearSetId: "missing" }, AT);
    edits = withDetailsChange(edits, "f".repeat(24), { site: "Nowhere" }, AT);
    edits = withTodo(edits, "dahab", todoId, true, AT);
    edits = withTodo(edits, "dahab", "gone", true, AT);
    edits = withTodo(edits, "malta", "t1", true, AT);

    const result = await savePhoneEdits(edits, dives, trips);
    expect(result.dives).toBe(1);
    expect(result.todos).toBe(1);
    expect(result.skipped).toHaveLength(4);

    expect((await dives.get(added[0]))!.details).toEqual({ site: "Koparki", gas: { o2: 0.32, he: 0 } });
    const todo = (await trips.get("dahab"))!.todos![0];
    expect(todo).toMatchObject({ done: true, doneAt: AT });
  });
});
