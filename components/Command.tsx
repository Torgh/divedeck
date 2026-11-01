"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useLang";

/** A command to paste somewhere else (Claude Code, a terminal), with a button that copies it. */
export function Command({ text, block }: { text: string; block?: boolean }) {
  const [copied, setCopied] = useState(false);
  const t = useT();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure origin): the text stays there to select by hand.
    }
  }

  const button = (
    <button type="button" className="copy" onClick={copy} aria-label={copied ? t("common.copied") : block ? t("command.copyCommands") : t("command.copyText", { text })}>
      {copied ? t("common.copied") : t("common.copy")}
    </button>
  );
  if (block) {
    return (
      <div className="command block">
        <pre>
          <code>{text}</code>
        </pre>
        {button}
      </div>
    );
  }
  return (
    <span className="command">
      <code>{text}</code>
      {button}
    </span>
  );
}
