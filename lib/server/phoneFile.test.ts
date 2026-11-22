import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readExport } from "../exportFile";
import { activeBackend, FolderBackend } from "./backends";
import { DiveStore } from "./diveStore";
import { PHONE_FILE_DELAY_MS, PHONE_FILE_NAME, phoneFileLocation, withPhoneFile, writePhoneFile } from "./phoneFile";
import { isolateEnv, restoreEnv } from "../../test-env";

const ROOT = path.resolve(__dirname, "..", "..");
const SPRING = new Uint8Array(fs.readFileSync(path.join(ROOT, "examples", "spring-2026.uddf")));
const saved = { ...process.env };
let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "adm-phone-file-"));
  for (const name of Object.keys(process.env)) if (/^ONEDRIVE/i.test(name)) delete process.env[name];
  isolateEnv(home);
});

afterEach(() => {
  vi.useRealTimers();
  restoreEnv(saved);
  fs.rmSync(home, { recursive: true, force: true });
});

const phoneFile = () => path.join(home, "phone", PHONE_FILE_NAME);
const readPhoneFile = () => readExport(JSON.parse(fs.readFileSync(phoneFile(), "utf-8")));

describe("the phone's file", () => {
  it("holds the whole log, as the export for the phone does", async () => {
    const backend = new FolderBackend("local", home);
    await new DiveStore(backend).importFile("spring.uddf", SPRING);
    await writePhoneFile(backend, new Date("2026-11-22T12:00:00Z"));
    const file = readPhoneFile();
    expect(file.exportedAt).toBe("2026-11-22T12:00:00.000Z");
    expect(file.dives).toHaveLength(5);
    expect(phoneFileLocation(backend)).toBe(phoneFile());
  });

  it("is written once the changes to the log settle, and not for the original files", async () => {
    process.env.DIVEDECK_PHONE_FILE = "on";
    vi.useFakeTimers();
    const backend = withPhoneFile(new FolderBackend("local", home));
    await backend.write("originals", "x.uddf", "x");
    await vi.advanceTimersByTimeAsync(PHONE_FILE_DELAY_MS + 100);
    expect(fs.existsSync(phoneFile())).toBe(false);

    await new DiveStore(backend).importFile("spring.uddf", SPRING);
    await vi.advanceTimersByTimeAsync(PHONE_FILE_DELAY_MS - 500);
    expect(fs.existsSync(phoneFile())).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(fs.existsSync(phoneFile())).toBe(true));
    expect(readPhoneFile().dives).toHaveLength(5);
  });

  it("is kept by the storage the app and the MCP server use, unless turned off", () => {
    expect(activeBackend()).not.toBeInstanceOf(FolderBackend);
    expect(activeBackend().location).toBe(home);
  });
});
