import { type Water, WATERS } from "@/lib/kit";
import { type Data, Failure, useSave } from "@/components/gear/shared";
import { useT } from "@/lib/i18n/useLang";

export function SitesCard({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const { save, failure } = useSave();
  const t = useT();
  const names = [...new Set([...data.siteNames, ...data.sites.map((s) => s.name)])].sort((a, b) => a.localeCompare(b));
  const waterAt = (name: string) => data.sites.find((s) => s.name.toLowerCase() === name.toLowerCase())?.water;
  async function choose(name: string, water: Water) {
    if (await save({ sites: [{ name, water: waterAt(name) === water ? null : water }] })) onSaved();
  }
  return (
    <section className="card stack" aria-labelledby="sites-h">
      <h2 id="sites-h" style={{ margin: 0 }}>
        {t("gearPage.sitesTitle")}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {t("gearPage.sitesHelp")}
      </p>
      {!names.length ? (
        <p className="muted">{t("gearPage.noSites")}</p>
      ) : (
        <ul className="gear-list">
          {names.map((name) => (
            <li key={name}>
              <strong>{name}</strong>
              <div className="segmented small" role="radiogroup" aria-label={t("gearPage.waterAt", { name })}>
                {WATERS.map((w) => (
                  <button key={w} type="button" role="radio" aria-checked={waterAt(name) === w} onClick={() => choose(name, w)}>
                    {t(`water.name.${w}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Failure text={failure} />
    </section>
  );
}
