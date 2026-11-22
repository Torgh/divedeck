/**
 * Gas planning for one dive, without AI: the rock-bottom pressure (the gas two divers need to get
 * from the deepest point to the surface after a problem there), the turn pressure by the rule of
 * thirds, how long the gas lasts at depth, and the oxygen limits of the mix. Simple, conservative
 * figures for recreational dives; the dive computer and the plan agreed with the buddy decide.
 */

import { ambientBar, PPO2_DECO_LIMIT, PPO2_WORK_LIMIT, RESERVE_WARN_BAR, SURFACE_BAR } from "./analysis";
import { pyRound } from "./py";

/** What a stressed diver breathes, L/min at the surface, at the least (a common planning figure). */
export const STRESS_RMV_L_MIN = 30;
export const ASCENT_RATE_M_MIN = 9;
export const STOP_DEPTH_M = 5;
export const STOP_MIN = 3;
/** Time at depth to sort out the problem before the ascent starts. */
export const PROBLEM_MIN = 1;

export interface GasPlanInput {
  depthM: number;
  tankL: number;
  startBar: number;
  /** The diver's own RMV, L/min at the surface. */
  rmvLMin: number;
  /** O2 and He fractions; air when left out. */
  o2?: number;
  he?: number;
}

export interface GasPlan {
  /** Start the ascent at this pressure at the latest (rounded up to 10 bar, never under 50). */
  rockBottomBar: number;
  /** The rock bottom as worked out, before rounding and the 50 bar floor. */
  rockBottomExactBar: number;
  /** Litres two divers need from the deepest point to the surface. */
  rockBottomL: number;
  /** What the two divers breathe while sharing, L/min at the surface. */
  sharedRmvLMin: number;
  /** Gas there is to dive with: start pressure less rock bottom. */
  usableBar: number;
  /** Turn by the rule of thirds: a third of the usable gas out, a third back, a third spare. */
  thirdsTurnBar: number;
  /** What the diver breathes at the planned depth, L/min. */
  atDepthLMin: number;
  /** How long the usable gas lasts at the planned depth, minutes. */
  minutesAtDepth: number;
  ppo2: number;
  /** Maximum operating depth at ppO2 1.4 and 1.6 bar. */
  mod14M: number;
  mod16M: number;
  /** Equivalent narcotic depth (oxygen counted as narcotic). */
  endM: number;
  /** The start pressure doesn't even cover the rock bottom. */
  notEnoughGas: boolean;
  problems: ("ppo2Unsafe" | "ppo2High" | "notEnoughGas" | "narcosis")[];
}

const roundUp10 = (bar: number) => Math.ceil(bar / 10) * 10;
const ata = (depthM: number) => ambientBar(depthM) / SURFACE_BAR;

export function planGas(input: GasPlanInput): GasPlan {
  const depth = Math.max(0, input.depthM);
  const o2 = input.o2 ?? 0.21;
  const he = input.he ?? 0;
  const stop = Math.min(STOP_DEPTH_M, depth);
  const shared = 2 * Math.max(STRESS_RMV_L_MIN, input.rmvLMin);
  // A minute at depth, the ascent to the stop (at its average depth), the stop, and the last metres.
  const toStopMin = (depth - stop) / ASCENT_RATE_M_MIN;
  const litres =
    shared *
    (PROBLEM_MIN * ata(depth) + toStopMin * ata((depth + stop) / 2) + (stop > 0 ? STOP_MIN * ata(stop) : 0) + (stop / ASCENT_RATE_M_MIN) * ata(stop / 2));
  const exact = input.tankL > 0 ? litres / input.tankL : Infinity;
  const rockBottom = Math.max(RESERVE_WARN_BAR, roundUp10(exact));
  const usable = Math.max(0, input.startBar - rockBottom);
  const atDepth = input.rmvLMin * ata(depth);
  const ppo2 = o2 * ambientBar(depth);
  const end = Math.max(0, (ambientBar(depth) * (1 - he) - SURFACE_BAR) * 10);
  const notEnough = input.startBar <= rockBottom;

  const problems: GasPlan["problems"] = [];
  if (ppo2 > PPO2_DECO_LIMIT) problems.push("ppo2Unsafe");
  else if (ppo2 > PPO2_WORK_LIMIT) problems.push("ppo2High");
  if (notEnough) problems.push("notEnoughGas");
  if (end > 30) problems.push("narcosis");

  return {
    rockBottomBar: rockBottom,
    rockBottomExactBar: pyRound(exact, 0),
    rockBottomL: pyRound(litres, 0),
    sharedRmvLMin: pyRound(shared, 1),
    usableBar: usable,
    thirdsTurnBar: notEnough ? input.startBar : Math.ceil((input.startBar - usable / 3) / 5) * 5,
    atDepthLMin: pyRound(atDepth, 1),
    minutesAtDepth: atDepth > 0 ? Math.floor((usable * input.tankL) / atDepth) : 0,
    ppo2: pyRound(ppo2, 2),
    mod14M: pyRound(Math.max(0, (PPO2_WORK_LIMIT / o2 - SURFACE_BAR) * 10), 1),
    mod16M: pyRound(Math.max(0, (PPO2_DECO_LIMIT / o2 - SURFACE_BAR) * 10), 1),
    endM: pyRound(end, 1),
    notEnoughGas: notEnough,
    problems,
  };
}

/** The middle of the values, or null without any. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
