import { describe, expect, it } from "vitest";
import type { DiveMetrics } from "./analysis";
import { autoDebrief } from "./autoDebrief";

const metrics = (over: Partial<DiveMetrics> = {}): DiveMetrics => ({
  durationMin: 40,
  maxDepthM: 18,
  avgDepthM: 10,
  minTempC: 20,
  gasUsedL: 1800,
  rmvLMin: 18,
  bottomRmvLMin: 19,
  sacBarMin: 1.2,
  endPressureBar: 70,
  maxAscentRateMMin: 8,
  avgAscentRateMMin: 4,
  fastAscentSeconds: 0,
  maxDescentRateMMin: 12,
  maxPpo2: 0.6,
  minPpo2: 0.21,
  maxEndM: null,
  cnsPercent: 3,
  otu: 2,
  safetyStopS: 240,
  hadDeco: false,
  ceilingViolationS: 0,
  minNdlMin: 20,
  sawtoothCount: 0,
  gases: ["Air"],
  alarms: [],
  score: 100,
  ...over,
});

describe("autoDebrief", () => {
  it("praises a clean dive and keeps the routine", () => {
    const md = autoDebrief(metrics());
    expect(md).toContain("### What went well");
    expect(md).toContain("Controlled ascent: peak 8 m/min.");
    expect(md).toContain("Surfaced with 70 bar");
    expect(md).toContain("Nothing to fix");
    expect(md).toContain("keep your RMV under 18 L/min");
  });

  it("puts the gas first on a dive that ended near empty, with heavy breathing at the bottom", () => {
    // The 21.11 Deepspot dive: 29 bar left, RMV 32.1, 39.6 at the bottom, NDL 3 min.
    const md = autoDebrief(metrics({ endPressureBar: 29, rmvLMin: 32.1, bottomRmvLMin: 39.6, minNdlMin: 3, maxDepthM: 34.5 }));
    expect(md).toContain("Surfaced with 29 bar: too little");
    expect(md).toContain("RMV 32.1 L/min (39.6 L/min at the bottom)");
    expect(md).toContain("NDL dropped to 3 min");
    const drill = md.split("### For the next dive")[1];
    expect(drill).toContain("rock bottom and the turn pressure");
  });

  it("compares the RMV with the diver's other dives", () => {
    expect(autoDebrief(metrics({ rmvLMin: 22 }), { rmvLMin: 18 })).toContain("higher than your average 18 L/min");
    expect(autoDebrief(metrics({ rmvLMin: 16 }), { rmvLMin: 20 })).toContain("Calmer breathing than your average");
  });

  it("speaks the diver's language", () => {
    const md = autoDebrief(metrics({ safetyStopS: 60 }), {}, "pl");
    expect(md).toContain("### Do poprawy");
    expect(md).toContain("Przystanek bezpieczeństwa tylko 1 min 0 s");
  });
});
