"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useRef, useState, type FormEvent, type PointerEvent } from "react";
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

// A failed toggle, remove, or clear leaves the row as the live query last showed it.
const ignoreFailure = () => {};

// Width of the red delete button a left swipe uncovers on touch screens.
const SWIPE_REVEAL = 88;

function GroceryRow({
  row,
  hints,
  onToggle,
  onRemove,
}: {
  row: Row;
  hints: HintContext;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const checked = row.checkedAt !== undefined;
  const hint = checked ? null : groceryHint(row.name, hints, row.recipeName);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  // A ref, so a move that lands before the next render still sees the drag.
  const drag = useRef<{ startX: number; base: number } | null>(null);
  const swiped = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Mouse users get the X button; only touch swipes.
    if (event.pointerType !== "touch") return;
    swiped.current = false;
    drag.current = { startX: event.clientX, base: offset };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    const { startX, base } = drag.current;
    const dx = event.clientX - startX;
    if (!swiped.current && Math.abs(dx) > 8) {
      swiped.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (swiped.current) setOffset(Math.max(-SWIPE_REVEAL, Math.min(0, base + dx)));
  };
  const onPointerUp = () => {
    if (drag.current === null) return;
    drag.current = null;
    setDragging(false);
    setOffset((current) => (current < -SWIPE_REVEAL / 2 ? -SWIPE_REVEAL : 0));
  };

  return (
    <div className={`grocery-swipe ${offset === 0 ? "" : "is-open"}`}>
      <button
        type="button"
        className="grocery-swipe-delete"
        aria-label={`Remove ${row.name}`}
        onClick={onRemove}
      >
        delete
      </button>
      <div
        className={`grocery-row ${checked ? "is-completed" : ""}`}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? "none" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          // A drag, or a tap on an open row, closes it instead of checking the item off.
          if (swiped.current || offset !== 0) {
            event.stopPropagation();
            swiped.current = false;
            setOffset(0);
          }
        }}
      >
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
        <button type="button" className="grocery-remove" aria-label={`Remove ${row.name}`} onClick={onRemove}>
          ×
        </button>
      </div>
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
  const removeEntry = useMutation(api.grocery.remove);
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
  const remove = (row: Row) => () => removeEntry({ entryId: row._id }).catch(ignoreFailure);
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
              <GroceryRow key={row._id} row={row} hints={hints} onToggle={toggle(row)} onRemove={remove(row)} />
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
                done.map((row) => (
                  <GroceryRow key={row._id} row={row} hints={hints} onToggle={toggle(row)} onRemove={remove(row)} />
                ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
