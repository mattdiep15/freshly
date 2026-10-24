"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { freshness } from "@/lib/freshness";
import { groceryHint } from "@/lib/grocery";
import { errorMessage } from "@/app/_components/errorMessage";
import { FoodSuggestions, suggestionsFor } from "@/app/_components/FoodSuggestions";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { Leekly } from "@/app/_components/ui/Leekly";
import { FixedTag } from "@/app/_components/ui/StatusTag";
import { useNow } from "@/app/_components/useNow";

type Row = Doc<"groceryItems">;
type HintContext = Parameters<typeof groceryHint>[1];

// A failed toggle or clear leaves the row as the live query last showed it.
const ignoreFailure = () => {};

function GroceryRow({ row, hints, onToggle }: { row: Row; hints: HintContext; onToggle: () => void }) {
  const checked = row.checkedAt !== undefined;
  const hint = checked ? null : groceryHint(row.name, hints);
  return (
    <div className={`grocery-row ${checked ? "is-completed" : ""}`}>
      <button
        type="button"
        className="grocery-check"
        aria-label={`${checked ? "Restore" : "Complete"} ${row.name}`}
        aria-pressed={checked}
        onClick={onToggle}
      >
        <span>{checked ? "✓" : ""}</span>
      </button>
      <FoodArt name={row.name} className="grocery-icon" />
      <span className="grocery-copy">
        <strong>{row.name}</strong>
        {hint && <small>{hint.text}</small>}
      </span>
      {hint?.kind === "in-fridge" && <FixedTag className="grocery-fridge-tag">in fridge</FixedTag>}
    </div>
  );
}

function AddForm() {
  const add = useMutation(api.grocery.add);
  const catalog = useQuery(api.foods.catalog);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const suggestions = suggestionsFor(catalog ?? [], query);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = query;
    if (!name.trim()) return;
    // Cleared before the server answers, so the next item can be typed right away.
    setQuery("");
    setActive(-1);
    setError(null);
    try {
      await add({ name });
    } catch (e) {
      setQuery(name);
      setError(errorMessage(e));
    }
  };

  return (
    <form className="grocery-form" onSubmit={submit}>
      <div className="grocery-input-wrap">
        <input
          value={query}
          placeholder="add something..."
          aria-label="Add a grocery item"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="grocery-suggestions"
          aria-activedescendant={active >= 0 ? `grocery-suggestions-${active}` : undefined}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length) {
              event.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (event.key === "ArrowUp" && suggestions.length) {
              event.preventDefault();
              setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (event.key === "Escape") {
              setQuery("");
              setActive(-1);
            } else if (event.key === "Enter" && active >= 0) {
              // Enter on a highlighted suggestion fills the field; the next Enter adds it.
              event.preventDefault();
              setQuery(suggestions[active].name);
              setActive(-1);
            }
          }}
        />
        {suggestions.length > 0 && (
          <FoodSuggestions
            id="grocery-suggestions"
            foods={suggestions}
            active={active}
            className="grocery-suggestions"
            onPick={(food) => {
              setQuery(food.name);
              setActive(-1);
            }}
          />
        )}
      </div>
      <button type="submit">add</button>
      {error && <p className="scan-error">{error}</p>}
    </form>
  );
}

export default function GroceryPage() {
  const now = useNow();
  const rows = useQuery(api.grocery.list);
  const active = useQuery(api.items.list, { status: "active" });
  const wasted = useQuery(api.items.list, { status: "wasted" });
  const toggleEntry = useMutation(api.grocery.toggle);
  const clearChecked = useMutation(api.grocery.clearChecked);
  const [showCompleted, setShowCompleted] = useState(false);

  const heading = (
    <section className="grocery-heading">
      <div>
        <p className="eyebrow">next trip</p>
        <h1>grocery list.</h1>
      </div>
      <Image className="grocery-heading-art" src="/illustrations/food/bag-2.png" width={441} height={485} alt="" aria-hidden="true" />
    </section>
  );
  if (now === null || rows === undefined || active === undefined || wasted === undefined) {
    return (
      <main className="grocery-page" aria-busy="true">
        {heading}
      </main>
    );
  }

  const hints: HintContext = {
    wastedNames: wasted.map((item) => item.name),
    fridge: active.map((item) => ({ name: item.name, quantity: item.quantity })),
    soonNames: active.filter((item) => freshness(item.expiresAt, now) === "soon").map((item) => item.name),
  };
  const toggle = (row: Row) => () => toggleEntry({ entryId: row._id }).catch(ignoreFailure);
  // Newest first, as the design adds to the top; checked ones by most recent check.
  const todo = rows.filter((row) => row.checkedAt === undefined).sort((a, b) => b._creationTime - a._creationTime);
  const done = rows.filter((row) => row.checkedAt !== undefined).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));

  return (
    <main className="grocery-page">
      {heading}
      <AddForm />
      {rows.length === 0 ? (
        <div className="grocery-empty">
          <Leekly />
          <p>nothing on the list.</p>
        </div>
      ) : (
        <>
          <section className="grocery-list" aria-label="Grocery list">
            {todo.map((row) => (
              <GroceryRow key={row._id} row={row} hints={hints} onToggle={toggle(row)} />
            ))}
          </section>
          {done.length > 0 && (
            <section className="grocery-completed">
              <div className="grocery-completed-heading">
                <button type="button" onClick={() => setShowCompleted((open) => !open)} aria-expanded={showCompleted}>
                  got it {done.length} <span aria-hidden="true">{showCompleted ? "−" : "+"}</span>
                </button>
                <button type="button" onClick={() => clearChecked().catch(ignoreFailure)}>
                  clear
                </button>
              </div>
              {showCompleted &&
                done.map((row) => <GroceryRow key={row._id} row={row} hints={hints} onToggle={toggle(row)} />)}
            </section>
          )}
        </>
      )}
    </main>
  );
}
