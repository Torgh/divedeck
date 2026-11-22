import { describe, expect, it } from "vitest";
import { median, planGas } from "./gasPlan";

describe("planGas", () => {
  it("works out the rock bottom two divers need from depth", () => {
    // 2 × 30 L/min: 1 min at 34 m, 3.2 min up to 5 m, 3 min at 5 m, then up: about 1150 L, 77 bar in 15 L.
    const p = planGas({ depthM: 34, tankL: 15, startBar: 200, rmvLMin: 25 });
    expect(p.sharedRmvLMin).toBe(60);
    expect(p.rockBottomExactBar).toBeGreaterThan(70);
    expect(p.rockBottomExactBar).toBeLessThan(80);
    expect(p.rockBottomBar).toBe(80);
    expect(p.usableBar).toBe(120);
    expect(p.thirdsTurnBar).toBe(160);
    expect(p.problems).toEqual(["narcosis"]);
  });

  it("uses the diver's RMV when it is above the stressed figure, and never goes under 50 bar", () => {
    expect(planGas({ depthM: 34, tankL: 15, startBar: 200, rmvLMin: 40 }).sharedRmvLMin).toBe(80);
    expect(planGas({ depthM: 6, tankL: 15, startBar: 200, rmvLMin: 15 }).rockBottomBar).toBe(50);
  });

  it("says how long the gas lasts at depth", () => {
    const p = planGas({ depthM: 20, tankL: 12, startBar: 200, rmvLMin: 20 });
    // 20 L/min × 2.97 ≈ 59 L/min at 20 m
    expect(p.atDepthLMin).toBeCloseTo(59.5, 0);
    expect(p.minutesAtDepth).toBe(Math.floor((p.usableBar * 12) / p.atDepthLMin));
  });

  it("flags a gas too rich for the depth and a tank too small", () => {
    const rich = planGas({ depthM: 40, tankL: 12, startBar: 200, rmvLMin: 20, o2: 0.32 });
    expect(rich.mod14M).toBeCloseTo(33.6, 0);
    expect(rich.problems).toContain("ppo2Unsafe");
    const small = planGas({ depthM: 40, tankL: 7, startBar: 150, rmvLMin: 20 });
    expect(small.notEnoughGas).toBe(true);
    expect(small.problems).toContain("notEnoughGas");
    expect(small.minutesAtDepth).toBe(0);
  });

  it("counts helium out of the narcotic depth", () => {
    expect(planGas({ depthM: 50, tankL: 24, startBar: 200, rmvLMin: 20, o2: 0.18, he: 0.45 }).endM).toBeLessThan(30);
  });
});

describe("median", () => {
  it("takes the middle value", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
