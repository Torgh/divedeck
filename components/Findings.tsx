"use client";

import type { Finding, Severity } from "@/lib/analysis";
import { useT } from "@/lib/i18n/useLang";
import { Icon } from "./Icons";

const ICON: Record<Severity, React.ReactNode> = { critical: Icon.stop, warning: Icon.alert, info: Icon.info, good: Icon.check };

/** A status is never colour alone: a dot, an icon and a word. */
export function StatusBadge({ severity }: { severity: Severity }) {
  const t = useT();
  return (
    <span className="status">
      <span className={`dot ${severity}`} aria-hidden="true" />
      <span className="secondary">{t(`severity.${severity}`)}</span>
    </span>
  );
}

/** A finding as a pill: its icon and title, coloured by severity. */
export function FindingBadge({ finding }: { finding: Finding }) {
  const t = useT();
  return (
    <span className={`badge ${finding.severity}`} title={finding.detail}>
      {ICON[finding.severity]}
      <span className="visually-hidden">{t(`severity.${finding.severity}`)}: </span>
      {finding.title}
    </span>
  );
}

export function Findings({ findings }: { findings: Finding[] }) {
  const t = useT();
  if (!findings.length) return <p className="muted">{t("findings.none")}</p>;
  return (
    <ul className="findings">
      {findings.map((f, i) => (
        <li key={`${f.title}${i}`}>
          <span className={`severity ${f.severity}`} aria-label={t(`severity.${f.severity}`)} role="img">
            {ICON[f.severity]}
          </span>
          <div>
            <div className="title">{f.title}</div>
            <div className="secondary">{f.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
