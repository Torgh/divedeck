import { detailsPatch, type PhoneEdits } from "../phoneEdits";
import { setTodoDone } from "../trip";
import { DiveStore } from "./diveStore";
import { KitStore } from "./kitStore";
import { TripStore } from "./tripStore";

export interface PhoneEditsResult {
  dives: number;
  todos: number;
  /** What couldn't be saved, and why. */
  skipped: string[];
}

/**
 * Saves what the diver changed on the phone: the details of each dive (after the file's own dives
 * were imported, so a dive added on the phone gets its details too) and the to-dos ticked off.
 */
export async function savePhoneEdits(edits: PhoneEdits, dives = new DiveStore(), trips = new TripStore(), kit = new KitStore()): Promise<PhoneEditsResult> {
  const result: PhoneEditsResult = { dives: 0, todos: 0, skipped: [] };
  const sets = new Set((await kit.get()).sets.map((s) => s.id));
  for (const [id, { change }] of Object.entries(edits.details)) {
    if (!(await dives.get(id))) {
      result.skipped.push(`dive ${id.slice(0, 8)}: not in the log`);
      continue;
    }
    let patch;
    try {
      patch = detailsPatch(change);
    } catch (err) {
      result.skipped.push(`dive ${id.slice(0, 8)}: ${(err as Error).message}`);
      continue;
    }
    if (patch.gearSetId && !sets.has(patch.gearSetId)) {
      result.skipped.push(`dive ${id.slice(0, 8)}: no gear set "${patch.gearSetId}"`);
      delete patch.gearSetId;
    }
    await dives.updateDetails(id, patch);
    result.dives++;
  }
  for (const [tripId, ticks] of Object.entries(edits.todos)) {
    if (!(await trips.get(tripId))) {
      result.skipped.push(`trip ${tripId}: not saved on this PC`);
      continue;
    }
    await trips.update(tripId, (plan) => {
      for (const [todoId, tick] of Object.entries(ticks)) {
        if (!plan.todos?.some((t) => t.id === todoId)) {
          result.skipped.push(`trip ${tripId}: no to-do ${todoId}`);
          continue;
        }
        setTodoDone(plan, todoId, tick.done, tick.at);
        result.todos++;
      }
    });
  }
  return result;
}
