"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/components/useLive";
import { useSettings } from "@/components/useSettings";
import { Command } from "@/components/Command";
import type { Key } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/lib/i18n/useLang";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS: Key[] = ["companion.starter.debrief", "companion.starter.gas", "companion.starter.practise", "companion.starter.missing"];

export default function CompanionPage() {
  const { settings, error } = useSettings();
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  if (error) return <div className="error">{error}</div>;
  if (!settings) return <p className="muted">{t("common.loading")}</p>;
  const provider = settings.providers.find((p) => p.id === settings.provider)!;

  if (!provider.usesApi) {
    return (
      <div className="stack">
        <h1>{t("nav.companion")}</h1>
        <div className="card stack">
          <p>{rich(t("companion.runsIn", { app: provider.app ?? "", plan: provider.plan ?? "" }), { b: (s) => <strong>{s}</strong> })}</p>
          <ul>
            <li>
              <Command text="/mcp__divedeck__dive-review" />: {t("companion.reviewCmd")}
            </li>
            <li>
              <Command text="/mcp__divedeck__sort-out" />: {t("companion.sortOutCmd")}
            </li>
            <li>{t("companion.example")}</li>
          </ul>
          <p className="muted">{rich(t("companion.showUp"), { a: (s) => <Link href="/settings">{s}</Link> })}</p>
        </div>
      </div>
    );
  }

  if (!provider.key) {
    return (
      <div className="stack">
        <h1>{t("nav.companion")}</h1>
        <div className="notice">{rich(t("companion.addKey", { name: provider.name }), { a: (s) => <Link href="/settings">{s}</Link> })}</div>
      </div>
    );
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setFailure(null);
    try {
      const { answer } = await api<{ answer: string }>("/api/coach", "POST", { messages: next });
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (err) {
      setFailure((err as Error).message);
      setMessages(messages);
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{t("nav.companion")}</h1>
        <span className="muted">
          {provider.name} · <code>{settings.model}</code> · {t("companion.billed")}
        </span>
      </div>
      {messages.length === 0 && (
        <div className="stack" style={{ gap: "0.6rem" }}>
          <p className="secondary" style={{ margin: 0 }}>
            {t("companion.intro")}
          </p>
          <div className="chips">
            {STARTERS.map((key) => (
              <button key={key} type="button" className="chip" disabled={busy} onClick={() => send(t(key))}>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="chat" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="bubble assistant review">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </div>
          ) : (
            <div key={i} className="bubble user">
              {m.content}
            </div>
          ),
        )}
        {busy && <p className="typing">{t("companion.reading")}</p>}
        <div ref={end} />
      </div>
      {failure && <div className="error">{failure}</div>}
      <form className="composer" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="ask">
          {t("companion.ask")}
        </label>
        <textarea
          id="ask"
          rows={2}
          value={draft}
          placeholder={t("companion.placeholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <button className="button primary" type="submit" disabled={busy || !draft.trim()}>
          {t("companion.send")}
        </button>
        {messages.length > 0 && (
          <button className="button" type="button" disabled={busy} onClick={() => setMessages([])}>
            {t("companion.new")}
          </button>
        )}
      </form>
    </div>
  );
}
