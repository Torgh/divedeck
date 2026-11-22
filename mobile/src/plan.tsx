import { useMemo, useState } from "react";
import { ASCENT_RATE_M_MIN, median, planGas } from "@/lib/gasPlan";
import { gasLabel } from "@/lib/dive";
import { formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n/useLang";
import { type Kit, waterOf } from "@/lib/kit";
import { prepareDive } from "@/lib/prep";
import { analyzeRecord, chronological, type DiveRecord, effectiveDive, parseGas } from "@/lib/record";
import { estimateWeighting } from "@/lib/weighting";

const CHECKLIST_KEY = "divedeck-checklist";

/** Ticks of the checklist, kept on the phone between opening the app on the boat. */
function useTicks(): [Set<string>, (id: string) => void, () => void] {
  const [ticks, setTicks] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const store = (next: Set<string>) => {
    setTicks(next);
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...next]));
    } catch {
      // not kept: the list still works for now
    }
  };
  const toggle = (id: string) => {
    const next = new Set(ticks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    store(next);
  };
  return [ticks, toggle, () => store(new Set())];
}

const num = (text: string) => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(n) ? n : null;
};

/** Plan the next dive on the phone: gas (rock bottom, turn, MOD), what the log says, and a checklist. */
export function PlanScreen({ records, kit, now }: { records: DiveRecord[]; kit: Kit; now: Date }) {
  const t = useT();
  const lang = useLang();
  const log = useMemo(() => chronological(records).map((r) => ({ record: r, dive: effectiveDive(r), metrics: analyzeRecord(r).metrics })), [records]);
  const recent = log.filter((d) => d.metrics.rmvLMin !== null).slice(-10);
  const rmvLog = median(recent.map((d) => d.metrics.rmvLMin!));
  const bottomLog = median(log.flatMap((d) => (d.metrics.bottomRmvLMin === null ? [] : [d.metrics.bottomRmvLMin])).slice(-10));
  const last = log.at(-1);
  const sites = [...new Set(log.flatMap((d) => (d.dive.site ? [d.dive.site] : [])))];

  const [site, setSite] = useState(last?.dive.site ?? "");
  const [depth, setDepth] = useState(last ? String(Math.round(last.metrics.maxDepthM)) : "18");
  const [gas, setGas] = useState("air");
  const [setId, setSetId] = useState(last?.record.details.gearSetId ?? kit.sets[0]?.id ?? "");
  const set = kit.sets.find((s) => s.id === setId) ?? null;
  const setTank = set ? kit.items.find((i) => i.kind === "tank" && set.itemIds.includes(i.id))?.volumeL : undefined;
  const [tank, setTank_] = useState(String(setTank ?? last?.dive.tanks[0]?.volumeL ?? 12));
  const [start, setStart] = useState("200");
  const [useBottom, setUseBottom] = useState(false);
  const [rmvText, setRmvText] = useState(rmvLog !== null ? String(Math.round(rmvLog * 10) / 10) : "");
  const rmv = useBottom && bottomLog !== null ? bottomLog : num(rmvText);

  const mix = parseGas(gas);
  const depthM = num(depth);
  const tankL = num(tank);
  const startBar = num(start);
  const plan = mix && depthM && tankL && startBar && rmv ? planGas({ depthM, tankL, startBar, rmvLMin: rmv, o2: mix.o2, he: mix.he }) : null;
  // The React Compiler keeps these from being worked out again on every keystroke elsewhere.
  const prep = prepareDive(records, { site: site.trim() || undefined, maxDepthM: depthM ?? undefined, gas }, now, lang);
  const water = waterOf(kit, {}, site)?.water ?? set?.water ?? "salt";
  const estimate = set ? estimateWeighting(kit, records, set, water, undefined, null, lang) : null;
  const [ticks, toggle, reset] = useTicks();
  const n = (x: number, digits = 1) => formatNumber(x, digits, "", lang);
  const gasName = mix ? gasLabel({ id: "", name: "", ...mix }) : gas;

  const checks: { id: string; text: string }[] = [
    ...(set ? kit.items.filter((i) => set.itemIds.includes(i.id)).map((i) => ({ id: `item:${i.id}`, text: i.name })) : []),
    ...(estimate?.leadKg !== null && estimate?.leadKg !== undefined ? [{ id: "lead", text: t("checklist.lead", { kg: n(estimate.leadKg) }) }] : []),
    { id: "gas", text: t("checklist.gasSet", { gas: gasName }) },
    { id: "pressure", text: t("checklist.pressure", { bar: startBar ?? 200 }) },
    ...(plan ? [{ id: "plan", text: t("checklist.plan", { rb: plan.rockBottomBar, turn: plan.thirdsTurnBar }) }] : []),
    { id: "buddy", text: t("checklist.buddy") },
    { id: "weight", text: t("checklist.weightCheck") },
  ];
  const done = checks.filter((c) => ticks.has(c.id)).length;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="page-head">
        <h1>{t("plan.title")}</h1>
      </div>
      <p className="secondary" style={{ margin: 0 }}>
        {t("plan.intro")}
      </p>

      <form className="form card" onSubmit={(e) => e.preventDefault()}>
        <label className="wide">
          {t("plan.site")}
          <input value={site} onChange={(e) => setSite(e.target.value)} list="plan-sites" />
          <datalist id="plan-sites">
            {sites.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          {t("plan.depth")}
          <input value={depth} onChange={(e) => setDepth(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          {t("plan.gas")}
          <input value={gas} onChange={(e) => setGas(e.target.value)} placeholder="air, EAN32" />
        </label>
        <label>
          {t("plan.set")}
          <select
            value={setId}
            onChange={(e) => {
              setSetId(e.target.value);
              const s = kit.sets.find((x) => x.id === e.target.value);
              const v = s ? kit.items.find((i) => i.kind === "tank" && s.itemIds.includes(i.id))?.volumeL : undefined;
              if (v) setTank_(String(v));
            }}
          >
            <option value="">{t("plan.noSet")}</option>
            {kit.sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("plan.tank")}
          <input value={tank} onChange={(e) => setTank_(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          {t("plan.start")}
          <input value={start} onChange={(e) => setStart(e.target.value)} inputMode="numeric" />
        </label>
        <label>
          {t("plan.rmv")}
          <input value={useBottom && bottomLog !== null ? n(bottomLog) : rmvText} onChange={(e) => setRmvText(e.target.value)} inputMode="decimal" disabled={useBottom} />
          <span className="muted">{rmvLog !== null ? t("plan.rmvFrom", { n: recent.length }) : t("plan.rmvNone")}</span>
        </label>
        {bottomLog !== null && (
          <label className="wide check">
            <input type="checkbox" checked={useBottom} onChange={(e) => setUseBottom(e.target.checked)} /> {t("plan.useBottom", { rmv: n(bottomLog) })}
          </label>
        )}
        {!mix && gas.trim() && <p className="wide error">{t("plan.badGas")}</p>}
      </form>

      {plan && depthM ? (
        <>
          <section className="card metric-card" aria-labelledby="gas-plan-h">
            <h3 id="gas-plan-h">{t("plan.gasPlan")}</h3>
            <div className="kv">
              <span>{t("plan.rockBottom")}</span>
              <strong className={plan.notEnoughGas ? "warn" : ""}>{plan.rockBottomBar} bar</strong>
            </div>
            <div className="kv">
              <span>{t("plan.turn")}</span>
              <strong>{plan.thirdsTurnBar} bar</strong>
            </div>
            <div className="kv">
              <span>{t("plan.atDepth", { depth: n(depthM) })}</span>
              <strong>{t("plan.atDepthValue", { lmin: n(plan.atDepthLMin), min: plan.minutesAtDepth })}</strong>
            </div>
            <span className="foot">
              {t("plan.rockBottomHelp", { depth: n(depthM), litres: plan.rockBottomL, shared: n(plan.sharedRmvLMin, 0), rate: ASCENT_RATE_M_MIN })} {t("plan.turnHelp")}
            </span>
          </section>

          <section className="card metric-card" aria-labelledby="oxygen-h">
            <h3 id="oxygen-h">{t("plan.oxygen")}</h3>
            <div className="kv">
              <span>{t("plan.ppo2", { depth: n(depthM) })}</span>
              <strong className={plan.ppo2 > 1.4 ? "warn" : ""}>{n(plan.ppo2, 2)}</strong>
            </div>
            <div className="kv">
              <span>{t("plan.mod")}</span>
              <strong>{t("plan.modValue", { mod14: n(plan.mod14M, 0), mod16: n(plan.mod16M, 0) })}</strong>
            </div>
            <div className="kv">
              <span>{t("plan.end")}</span>
              <strong>{n(plan.endM, 0)} m</strong>
            </div>
          </section>

          {plan.problems.length > 0 && (
            <div className="notice">
              {plan.problems.map((p) => (
                <p key={p} style={{ margin: "0.25rem 0" }}>
                  {t(`plan.problem.${p}`, { ppo2: n(plan.ppo2, 2), depth: n(depthM), start: startBar ?? 0, rb: plan.rockBottomBar, end: n(plan.endM, 0) })}
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="notice">{t("plan.fillIn")}</div>
      )}

      {prep.notes.length > 0 && (
        <section className="card stack" aria-labelledby="from-log-h">
          <h2 id="from-log-h" style={{ margin: 0 }}>
            {t("plan.fromLog")}
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {prep.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack" aria-labelledby="checklist-h">
        <div className="chart-head">
          <h2 id="checklist-h" style={{ margin: 0 }}>
            {t("checklist.title")}
          </h2>
          <span className="muted">{t("checklist.progress", { done, n: checks.length })}</span>
        </div>
        {set && <span className="secondary">{t("checklist.gearIn", { set: set.name })}</span>}
        <ul className="todos">
          {checks.map((c) => (
            <li key={c.id} className={ticks.has(c.id) ? "done" : undefined}>
              <label>
                <input type="checkbox" checked={ticks.has(c.id)} onChange={() => toggle(c.id)} />
                <span>{c.text}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="button" onClick={reset} disabled={!done}>
            {t("checklist.reset")}
          </button>
        </div>
      </section>

      <p className="muted" style={{ margin: 0 }}>
        {t("plan.computerDecides")}
      </p>
    </div>
  );
}
