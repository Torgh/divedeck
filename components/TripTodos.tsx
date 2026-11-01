"use client";

import { type FormEvent, useState } from "react";
import type { TripEdit } from "@/components/TripPrep";
import { api } from "@/components/useLive";
import { useT } from "@/lib/i18n/useLang";
import type { TripTodo } from "@/lib/trip";

/**
 * What is still to sort out before the trip: your companion's list (questions for the dive centre,
 * gear, a course) and your own. Tick them off here; the next preparation sees what you did. Without
 * `edit` (the phone) the list is only shown.
 */
export function TripTodos({ todos, cards, edit }: { todos: TripTodo[]; cards: { itemId: string; title: string }[]; edit?: TripEdit }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [card, setCard] = useState("");

  async function call(method: string, body: unknown) {
    if (!edit) return false;
    setBusy(true);
    setFailure(null);
    try {
      await api(`/api/trips/${edit.tripId}/todos`, method, body);
      edit.onChange();
      return true;
    } catch (err) {
      setFailure((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (await call("POST", { text, ...(card ? { itemId: card } : {}) })) {
      setText("");
      setCard("");
    }
  }

  const title = (itemId?: string) => cards.find((c) => c.itemId === itemId)?.title;
  const open = todos.filter((todo) => !todo.done);
  const done = todos.filter((todo) => todo.done);
  const item = (todo: TripTodo) => (
    <li key={todo.id} className={todo.done ? "done" : undefined}>
      <label>
        <input type="checkbox" checked={todo.done} disabled={busy || !edit} onChange={(e) => call("PATCH", { id: todo.id, done: e.target.checked })} />
        <span>{todo.text}</span>
      </label>
      {todo.itemId && title(todo.itemId) && (
        <a className="todo-card" href={`#card-${todo.itemId}`}>
          {title(todo.itemId)}
        </a>
      )}
      {edit && todo.by === "diver" && (
        <button type="button" className="todo-remove" aria-label={t("todos.remove", { text: todo.text })} disabled={busy} onClick={() => call("DELETE", { id: todo.id })}>
          ×
        </button>
      )}
    </li>
  );

  return (
    <section className="card stack" id="todos" aria-labelledby="todos-h">
      <div className="chart-head">
        <h2 id="todos-h" style={{ margin: 0 }}>
          {t("todos.title")}
        </h2>
        <span className="muted">
          {open.length ? [t("todos.open", { n: open.length }), done.length ? t("todos.done", { n: done.length }) : null].filter(Boolean).join(" · ") : todos.length ? t("todos.allDone") : ""}
        </span>
      </div>
      {todos.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          {edit ? t("todos.nothingEdit") : t("todos.nothing")}
        </p>
      )}
      {open.length > 0 && <ul className="todos">{open.map(item)}</ul>}
      {done.length > 0 && (
        <details>
          <summary className="muted">{t("todos.done", { n: done.length })}</summary>
          <ul className="todos">{done.map(item)}</ul>
        </details>
      )}
      {edit && (
        <form className="row todo-add" onSubmit={add}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("todos.placeholder")} aria-label={t("todos.new")} maxLength={300} />
          {cards.length > 0 && (
            <select value={card} onChange={(e) => setCard(e.target.value)} aria-label={t("todos.aboutCard")}>
              <option value="">{t("todos.wholeTrip")}</option>
              {cards.map((c) => (
                <option key={c.itemId} value={c.itemId}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <button className="button" type="submit" disabled={busy || !text.trim()}>
            {t("common.add")}
          </button>
        </form>
      )}
      {failure && <div className="error">{failure}</div>}
    </section>
  );
}
