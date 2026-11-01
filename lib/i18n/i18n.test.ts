import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { analyzeDive, progressInsights } from "../analysis";
import { formatDate, formatDateRange, formatMinutes, formatNumber, formatTripWhen } from "../format";
import { en } from "./en";
import { es } from "./es";
import { detectLang, LANGS, parseLang, translate, writeIn, type Key } from "./index";
import { pl } from "./pl";
import type { Plural } from "./plural";
import { rich } from "./rich";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseUddf } from "../uddf";

type Node = string | Plural | { [key: string]: Node };

/** Every text of a language as "key" → its forms, plurals as "key#form". */
function flatten(node: Node, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof node === "string") out.set(prefix, node);
  else if ("plural" in node) {
    for (const [form, text] of Object.entries(node)) if (form !== "plural") out.set(`${prefix}#${form}`, text as string);
  } else for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
const base = (key: string) => key.split("#")[0];

describe("translations", () => {
  const english = flatten(en as unknown as Node);
  const englishParams = new Map<string, Set<string>>();
  for (const [key, text] of english) {
    const set = englishParams.get(base(key)) ?? new Set();
    params(text).forEach((p) => set.add(p));
    englishParams.set(base(key), set);
  }

  for (const [lang, messages] of [["pl", pl], ["es", es]] as const) {
    it(`${lang} uses only the placeholders and tags English has`, () => {
      for (const [key, text] of flatten(messages as unknown as Node)) {
        const allowed = englishParams.get(base(key));
        expect(allowed, `${lang} ${key} is not in English`).toBeDefined();
        for (const p of params(text)) expect(allowed!.has(p), `${lang} ${key}: unknown {${p}}`).toBe(true);
        const englishText = english.get(key) ?? english.get(`${base(key)}#other`)!;
        expect(tags(text), `${lang} ${key}: tags`).toEqual(tags(englishText));
      }
    });

    it(`${lang} keeps every placeholder of a single text`, () => {
      for (const [key, text] of flatten(messages as unknown as Node)) {
        if (key.includes("#")) continue;
        expect(params(text), `${lang} ${key}`).toEqual(params(english.get(key)!));
      }
    });

    it(`${lang} keeps the "{metric}:" prefix the dashboard matches progress notes by`, () => {
      expect(translate(lang, "progress.improving", { metric: "X" })).toMatch(/^X:/);
      expect(translate(lang, "progress.worsening", { metric: "X" })).toMatch(/^X:/);
    });
  }
});

describe("translate", () => {
  it("fills in parameters", () => {
    expect(translate("en", "dive.title", { seq: 3 })).toBe("Dive #3");
    expect(translate("pl", "dive.title", { seq: 3 })).toBe("Nurkowanie #3");
    expect(translate("es", "dive.title", { seq: 3 })).toBe("Inmersión #3");
  });

  it("picks the plural form by n, with Polish few and many", () => {
    const dives = (lang: "en" | "pl" | "es", n: number) => translate(lang, "log.count", { n });
    expect([1, 2, 5].map((n) => dives("en", n))).toEqual(["1 dive", "2 dives", "5 dives"]);
    expect([1, 2, 5, 22, 25].map((n) => dives("pl", n))).toEqual(["1 nurkowanie", "2 nurkowania", "5 nurkowań", "22 nurkowania", "25 nurkowań"]);
    expect([1, 2].map((n) => dives("es", n))).toEqual(["1 inmersión", "2 inmersiones"]);
  });

  it("shows the key of an unknown text instead of failing", () => {
    expect(translate("pl", "no.such" as Key)).toBe("no.such");
  });

  it("asks the in-app AI to write in the language", () => {
    expect(writeIn("pl")).toBe("Write in Polish.");
  });
});

describe("language choice", () => {
  it("reads only supported languages", () => {
    expect(LANGS.map(parseLang)).toEqual(LANGS);
    expect(parseLang("de")).toBeUndefined();
    expect(parseLang(null)).toBeUndefined();
  });

  it("follows the first browser language DiveDeck speaks", () => {
    expect(detectLang(["pl-PL", "en-US"])).toBe("pl");
    expect(detectLang(["de-DE", "es-MX", "en"])).toBe("es");
    expect(detectLang(["fr-FR"])).toBe("en");
    expect(detectLang([])).toBe("en");
  });
});

describe("formatting in the app's language", () => {
  it("writes dates, durations and numbers per language", () => {
    expect(formatDate("2026-09-25T20:29:14", true, "pl")).toBe("25 wrz 2026, 20:29");
    expect(formatDate(null, true, "es")).toBe("Sin fecha");
    expect(formatMinutes(65, "pl")).toBe("1 godz. 05 min");
    expect(formatNumber(39.24, 1, "m", "pl")).toBe("39,2 m");
    expect(formatDateRange("2027-05-08", "2027-05-15", "es")).toBe("8–15 may 2027");
    const today = new Date("2026-10-25T09:00:00Z");
    expect(formatTripWhen({ when: "upcoming", daysUntil: 5, endDate: null }, today, "pl")).toBe("Za 5 dni");
    expect(formatTripWhen({ when: "past", daysUntil: -9, endDate: "2026-10-20" }, today, "es")).toBe("Terminó hace 5 días");
  });
});

describe("findings in the app's language", () => {
  const xml = readFileSync(path.resolve(__dirname, "../../fixtures/uddf/edge-cases.uddf"), "utf-8");
  const dives = parseUddf(xml);

  it("keeps English for the MCP server and translates every finding for the app", () => {
    const english = dives.flatMap((d) => analyzeDive(d).findings);
    const polish = dives.flatMap((d) => analyzeDive(d, "pl").findings);
    expect(english.map((f) => f.title)).toContain("Deco ceiling violated");
    expect(polish.map((f) => f.title)).toContain("Przekroczony sufit dekompresyjny");
    expect(polish.map((f) => f.severity)).toEqual(english.map((f) => f.severity));
    // No placeholder is left unfilled.
    for (const f of [...polish, ...dives.flatMap((d) => analyzeDive(d, "es").findings)]) expect(f.detail).not.toMatch(/\{\w+\}/);
    expect(dives.map((d) => analyzeDive(d, "es").metrics)).toEqual(dives.map((d) => analyzeDive(d).metrics));
  });

  it("writes progress notes in the language, numbers too", () => {
    expect(progressInsights([], "es")[0].title).toBe("Aún no hay suficiente historial");
    const history = [10, 12, 20, 22].map((rmvLMin) => ({ rmvLMin }));
    const note = progressInsights(history, "pl").find((f) => f.title.startsWith("Zużycie gazu"));
    expect(note?.title).toBe("Zużycie gazu (RMV, L/min): pogorszenie");
    expect(note?.detail).toContain("z 11 na 21");
  });
});

describe("rich", () => {
  it("wraps tagged chunks and keeps the text around them", () => {
    const out = rich("Click <b>Save</b> or <a>read more</a>.", { b: (s) => `[${s}]`, a: (s) => `(${s})` }) as unknown[];
    const text = out.map((n) => (isValidElement(n) ? (n as ReactElement<{ children: string }>).props.children : n)).join("");
    expect(text).toBe("Click [Save] or (read more).");
  });

  it("leaves unknown tags as they are", () => {
    expect((rich("a <x>b</x>", {}) as unknown[]).join("")).toBe("a <x>b</x>");
  });
});
