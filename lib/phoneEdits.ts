/**
 * What the diver changed on the phone: a dive's details (site, buddy, tank, gas, lead, how the
 * weighting felt, notes) and the to-dos ticked off on a trip. The phone shows them over the export at
 * once, sends them to the PC with "Send to PC", and forgets each one once an export already holds it.
 */

import { type DetailsPatch, type DiveRecord, applyDetailsPatch, parseGas } from "./record";
import type { TripPlan } from "./trip";

/** A details change as the forms send it: the gas as text ("EAN32"), as on the PC's API. */
export type DetailsChange = Omit<DetailsPatch, "gas"> & { gas?: string | null };

export interface PhoneEdits {
  /** Dive id → the fields changed (merged over earlier changes), and when. */
  details: Record<string, { change: DetailsChange; at: string }>;
  /** Trip id → to-do id → ticked off or not, and when. */
  todos: Record<string, Record<string, { done: boolean; at: string }>>;
}

export const noEdits = (): PhoneEdits => ({ details: {}, todos: {} });

export function countEdits(edits: PhoneEdits): number {
  return Object.keys(edits.details).length + Object.values(edits.todos).reduce((n, t) => n + Object.keys(t).length, 0);
}

/** The change as stored on a dive: the gas text read as fractions. Throws on a gas it can't read. */
export function detailsPatch(change: DetailsChange): DetailsPatch {
  const { gas, ...rest } = change;
  if (gas === undefined) return rest;
  if (gas === null || !gas.trim()) return { ...rest, gas: null };
  const mix = parseGas(gas);
  if (!mix) throw new Error(`Can't read the gas "${gas}". Write it like air, EAN32, oxygen or Tx 18/45.`);
  return { ...rest, gas: mix };
}

export function withDetailsChange(edits: PhoneEdits, diveId: string, change: DetailsChange, at: string): PhoneEdits {
  detailsPatch(change); // refuse a gas it can't read before keeping it
  const before = edits.details[diveId]?.change ?? {};
  return { ...edits, details: { ...edits.details, [diveId]: { change: { ...before, ...change }, at } } };
}

export function withTodo(edits: PhoneEdits, tripId: string, todoId: string, done: boolean, at: string): PhoneEdits {
  return { ...edits, todos: { ...edits.todos, [tripId]: { ...edits.todos[tripId], [todoId]: { done, at } } } };
}

/** The dives with the phone's changes to their details. */
export function applyDiveEdits(records: DiveRecord[], edits: PhoneEdits): DiveRecord[] {
  return records.map((r) => {
    const edit = edits.details[r.id];
    if (!edit) return r;
    try {
      return { ...r, details: applyDetailsPatch(r.details, detailsPatch(edit.change)) };
    } catch {
      return r;
    }
  });
}

/** The trips with the to-dos ticked off (or back on) on the phone. */
export function applyTripEdits(trips: TripPlan[], edits: PhoneEdits): TripPlan[] {
  return trips.map((trip) => {
    const ticks = edits.todos[trip.id];
    if (!ticks || !trip.todos) return trip;
    return {
      ...trip,
      todos: trip.todos.map((todo) => {
        const tick = ticks[todo.id];
        if (!tick) return todo;
        const { doneAt: _, ...rest } = todo;
        return tick.done ? { ...rest, done: true, doneAt: tick.at } : { ...rest, done: false };
      }),
    };
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The changes an export doesn't hold yet. A dive's change goes once its details there already read
 * the same; a to-do's once it is ticked the same way. Changes to dives or trips the export doesn't
 * have (a dive imported on the phone) stay.
 */
export function pendingEdits(edits: PhoneEdits, dives: DiveRecord[], trips: TripPlan[]): PhoneEdits {
  const out = noEdits();
  const byId = new Map(dives.map((d) => [d.id, d]));
  for (const [id, edit] of Object.entries(edits.details)) {
    const record = byId.get(id);
    let held = false;
    try {
      held = !!record && same(applyDetailsPatch(record.details, detailsPatch(edit.change)), record.details);
    } catch {
      held = true; // a change it can't read helps nobody
    }
    if (!held) out.details[id] = edit;
  }
  const tripsById = new Map(trips.map((t) => [t.id, t]));
  for (const [tripId, ticks] of Object.entries(edits.todos)) {
    const trip = tripsById.get(tripId);
    for (const [todoId, tick] of Object.entries(ticks)) {
      const todo = trip?.todos?.find((t) => t.id === todoId);
      if (trip && (!todo || todo.done === tick.done)) continue; // done there, or the to-do is gone
      out.todos[tripId] = { ...out.todos[tripId], [todoId]: tick };
    }
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads stored or sent changes, skipping what doesn't look like one. */
export function readEdits(json: unknown): PhoneEdits {
  const out = noEdits();
  if (!isObject(json)) return out;
  if (isObject(json.details)) {
    for (const [id, edit] of Object.entries(json.details)) {
      if (isObject(edit) && isObject(edit.change) && typeof edit.at === "string") out.details[id] = { change: edit.change as DetailsChange, at: edit.at };
    }
  }
  if (isObject(json.todos)) {
    for (const [tripId, ticks] of Object.entries(json.todos)) {
      if (!isObject(ticks)) continue;
      for (const [todoId, tick] of Object.entries(ticks)) {
        if (isObject(tick) && typeof tick.done === "boolean" && typeof tick.at === "string") out.todos[tripId] = { ...out.todos[tripId], [todoId]: { done: tick.done, at: tick.at } };
      }
    }
  }
  return out;
}
