"use client";

import { useAction, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { addDays, dateInputValue, endOfLocalDay, freshness, localNoon, statusTiming } from "@/lib/freshness";
import { splitFoodName } from "@/lib/foodName";
import { groupForCategory, type FoodGroup } from "@/lib/fullness";
import { errorMessage } from "@/app/_components/errorMessage";
import { FoodSuggestions, suggestionsFor, type CatalogFood } from "@/app/_components/FoodSuggestions";
import { FoodArt } from "@/app/_components/ui/FoodArt";
import { SourceNote } from "@/app/_components/ui/SourceNote";
import { StatusTag } from "@/app/_components/ui/StatusTag";
import { useNow } from "@/app/_components/useNow";

type Storage = "fridge" | "freezer";

const UNITS = ["items", "lbs", "bag", "carton", "container"] as const;
const GROUPS: [FoodGroup, string][] = [
  ["vegetables", "vegetables"],
  ["fruit", "fruit"],
  ["protein", "protein"],
  ["dairy-eggs", "dairy and eggs"],
  ["grains", "grains"],
  ["other", "other"],
];
const MAX_GOOD_FOR_DAYS = 365;

type Draft = {
  draftId: number;
  name: string;
  food: CatalogFood | null;
  group: FoodGroup | null;
  quantity: number;
  unit: (typeof UNITS)[number];
  storage: Storage;
  boughtOn: string;
  // null until a sourced range or the user gives one.
  goodForDays: number | null;
  // False while goodForDays is the sourced value, so the backend keeps the sourced date.
  goodForEdited: boolean;
  showMoreDetails: boolean;
};

let nextDraftId = 0;

function emptyDraft(): Draft {
  return {
    draftId: nextDraftId++,
    name: "",
    food: null,
    group: null,
    quantity: 1,
    unit: "items",
    storage: "fridge",
    boughtOn: dateInputValue(Date.now()),
    goodForDays: null,
    goodForEdited: false,
    showMoreDetails: window.innerWidth >= 768,
  };
}

// Same fallback as lib/expiry: the storage's range, else the fridge range.
function sourcedRange(food: CatalogFood | null, storage: Storage) {
  if (!food) return null;
  return (storage === "freezer" ? food.freezerDays : food.fridgeDays) ?? food.fridgeDays ?? null;
}

function withFood(draft: Draft, food: CatalogFood | null, storage = draft.storage): Draft {
  const range = sourcedRange(food, storage);
  return {
    ...draft,
    food,
    storage,
    group: food ? (groupForCategory(food.category) ?? draft.group) : draft.group,
    ...(draft.goodForEdited ? {} : { goodForDays: range?.min ?? null }),
  };
}

function expiresAtFor(draft: Draft): number | undefined {
  return draft.goodForDays === null ? undefined : endOfLocalDay(addDays(draft.boughtOn, draft.goodForDays));
}

function ManualItemSection({ draft, index, now, catalog, onChange, onRemove }: {
  draft: Draft;
  index: number;
  now: number;
  catalog: readonly CatalogFood[];
  onChange: (draft: Draft) => void;
  onRemove?: () => void;
}) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const suggestions = suggestionsFor(catalog, draft.name);
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const selectFood = (food: CatalogFood) => {
    onChange(withFood({ ...draft, name: food.name, goodForEdited: false }, food));
    setSuggestionsOpen(false);
  };
  const range = sourcedRange(draft.food, draft.storage);
  const expiresAt = expiresAtFor(draft);
  const status = freshness(expiresAt, now);
  const timing = statusTiming(expiresAt, now);
  const listId = `food-suggestions-${draft.draftId}`;
  // A picked FoodKeeper row shows its first name in the field and the variants under it, like the grocery list.
  const { base, detail } = draft.food?.name === draft.name ? splitFoodName(draft.name) : { base: draft.name, detail: "" };

  return (
    <section className={`manual-item-section ${status === "expired" ? "expired-surface" : ""}`} data-draft-id={draft.draftId}>
      <div className="manual-item-heading">
        <div className="manual-heading-copy">
          <h1>{index === 0 ? "add an item" : `item ${index + 1}`}</h1>
          {onRemove && (
            <button type="button" className="manual-remove" onClick={onRemove} aria-label={`Remove item ${index + 1}`}>
              remove
            </button>
          )}
          <span className="entry-status-meta">
            <StatusTag status={status} />
            {timing && <span className="status-timing">{timing}</span>}
          </span>
        </div>
        <div className="manual-preview">
          <div className="manual-preview-slot" key={`${draft.name.trim().toLowerCase()}-${draft.group}`}>
            {draft.name.trim() ? (
              <FoodArt name={draft.name} group={draft.group} className="manual-preview-art" />
            ) : (
              <span className="manual-preview-art food-letter-placeholder" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      <div className="manual-section-fields">
        <label className="manual-field manual-name-field">
          <span>food name</span>
          <input
            data-manual-name
            role="combobox"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            aria-controls={listId}
            aria-activedescendant={suggestionsOpen && suggestions.length > 0 ? `${listId}-${activeSuggestion}` : undefined}
            value={base}
            title={draft.name}
            autoComplete="off"
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => setSuggestionsOpen(false)}
            onKeyDown={(event) => {
              if (!suggestionsOpen || suggestions.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestion((value) => (value + 1) % suggestions.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestion((value) => (value - 1 + suggestions.length) % suggestions.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                selectFood(suggestions[activeSuggestion] ?? suggestions[0]);
              } else if (event.key === "Escape") {
                setSuggestionsOpen(false);
              }
            }}
            onChange={(event) => {
              const name = event.target.value;
              const key = name.trim().toLowerCase();
              const exact = catalog.find((f) => f.name === key || f.aliases.includes(key)) ?? null;
              // Typing away from a picked food drops its sourced days.
              onChange(withFood({ ...draft, name }, exact));
              setSuggestionsOpen(true);
              setActiveSuggestion(0);
            }}
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <FoodSuggestions
              id={listId}
              foods={suggestions}
              active={activeSuggestion}
              className="food-suggestions"
              iconClassName="suggestion-food-icon"
              onPick={selectFood}
            />
          )}
          {detail && <small className="manual-name-detail">{detail}</small>}
        </label>

        <fieldset className="manual-field manual-chip-field">
          <legend>food group</legend>
          <div>
            {GROUPS.map(([value, label]) => (
              <button
                type="button"
                className={draft.group === value ? "is-selected" : ""}
                aria-pressed={draft.group === value}
                key={value}
                onClick={() => update({ group: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="manual-paired-row manual-quantity-row">
          <div className="manual-field">
            <span>quantity</span>
            <div className="manual-stepper">
              <button type="button" aria-label="Less" onClick={() => update({ quantity: Math.max(1, draft.quantity - 1) })}>
                −
              </button>
              <input
                type="number"
                min="0.1"
                step={draft.unit === "lbs" ? "0.1" : "1"}
                aria-label="Quantity"
                value={draft.quantity}
                onChange={(event) => update({ quantity: Math.max(0.1, Number(event.target.value) || 1) })}
              />
              <button type="button" aria-label="More" onClick={() => update({ quantity: draft.quantity + 1 })}>
                +
              </button>
            </div>
          </div>
          <label className="manual-field">
            <span>unit</span>
            <select value={draft.unit} onChange={(event) => update({ unit: event.target.value as Draft["unit"] })}>
              {UNITS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="manual-field good-for-field">
          <span>good for</span>
          <div className="manual-stepper good-for-stepper">
            <button
              type="button"
              aria-label="Fewer days"
              disabled={draft.goodForDays === null}
              onClick={() => update({ goodForDays: Math.max(0, (draft.goodForDays ?? 1) - 1), goodForEdited: true })}
            >
              −
            </button>
            <input
              aria-label="Days it stays good"
              value={draft.goodForDays === null ? "" : `${draft.goodForDays} ${draft.goodForDays === 1 ? "day" : "days"}`}
              placeholder="not set"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(value)) update({ goodForDays: Math.max(0, Math.min(MAX_GOOD_FOR_DAYS, value)), goodForEdited: true });
              }}
            />
            <button
              type="button"
              aria-label="More days"
              onClick={() => update({ goodForDays: Math.min(MAX_GOOD_FOR_DAYS, (draft.goodForDays ?? 0) + 1), goodForEdited: true })}
            >
              +
            </button>
          </div>
          {range && !draft.goodForEdited ? (
            <small>
              shortest safe estimate. change it if you know better. <SourceNote source={range.source} />
            </small>
          ) : draft.goodForEdited ? (
            <small>your date.</small>
          ) : (
            <small>no sourced estimate for this food. set one if you know it.</small>
          )}
        </div>

        <button type="button" className="manual-more-details" onClick={() => update({ showMoreDetails: !draft.showMoreDetails })}>
          {draft.showMoreDetails ? "less details −" : "more details +"}
        </button>

        {draft.showMoreDetails && (
          <div className="manual-progressive-fields">
            <div className="manual-paired-row">
              <fieldset className="manual-field manual-toggle-field">
                <legend>where it&apos;s stored</legend>
                <div>
                  {(["fridge", "freezer"] as const).map((value) => (
                    <button
                      type="button"
                      className={draft.storage === value ? "is-selected" : ""}
                      aria-pressed={draft.storage === value}
                      key={value}
                      onClick={() => onChange(withFood(draft, draft.food, value))}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="manual-field">
              <span>bought on</span>
              <input
                type="date"
                max={dateInputValue(now)}
                value={draft.boughtOn}
                onChange={(event) => event.target.value && update({ boughtOn: event.target.value })}
              />
            </label>
          </div>
        )}

        {draft.name.trim() && !draft.food && (
          <div className="manual-unknown-tip">
            <span>food tip</span>
            <strong>{draft.name.trim()}</strong>
            <p>we&apos;ll look up how to store it once it&apos;s in your fridge.</p>
          </div>
        )}
      </div>
    </section>
  );
}

// Several items in one card, saved together; cancel discards every draft.
export function ManualEntryCard({ onCancel, onAdded }: {
  onCancel: () => void;
  onAdded: (itemIds: Id<"items">[]) => void;
}) {
  const now = useNow();
  const catalog = useQuery(api.foods.catalog);
  const addManual = useAction(api.receiptsNode.addManual);
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isValid = (draft: Draft) => draft.name.trim().length > 0;
  const lastDraft = drafts[drafts.length - 1];
  const allValid = drafts.every(isValid);
  if (now === null) return null;

  const appendDraft = () => {
    if (!isValid(lastDraft)) return;
    const next = emptyDraft();
    setDrafts((current) => [...current, next]);
    window.setTimeout(() => {
      const input = cardRef.current?.querySelector<HTMLElement>(`[data-draft-id="${next.draftId}"] [data-manual-name]`);
      input?.scrollIntoView({ block: "center" });
      input?.focus();
    }, 0);
  };

  const submit = async () => {
    if (!allValid || saving) return;
    setSaving(true);
    setError(null);
    const today = dateInputValue(Date.now());
    try {
      const ids = await Promise.all(
        drafts.map((draft) =>
          addManual({
            name: draft.name.trim(),
            quantity: draft.quantity,
            unit: draft.unit,
            location: draft.storage,
            purchasedAt: draft.boughtOn === today ? undefined : localNoon(draft.boughtOn),
            expiresAt: draft.goodForEdited ? expiresAtFor(draft) : undefined,
          }),
        ),
      );
      onAdded(ids);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <div
      className="manual-entry-card manual-entry-card--multi"
      ref={cardRef}
      onFocusCapture={(event) => {
        // Waits for the mobile keyboard to open before scrolling the field into view.
        const target = event.target;
        window.setTimeout(() => target instanceof HTMLElement && target.scrollIntoView({ block: "nearest" }), 120);
      }}
    >
      <div className="manual-card-top">
        <button type="button" className="manual-back" onClick={onCancel}>
          ← back
        </button>
      </div>
      {drafts.map((draft, index) => (
        <ManualItemSection
          key={draft.draftId}
          draft={draft}
          index={index}
          now={now}
          catalog={catalog ?? []}
          onChange={(next) => setDrafts((current) => current.map((d) => (d.draftId === next.draftId ? next : d)))}
          onRemove={index === 0 ? undefined : () => setDrafts((current) => current.filter((d) => d.draftId !== draft.draftId))}
        />
      ))}
      <button type="button" className="manual-add-another" disabled={!isValid(lastDraft)} onClick={appendDraft}>
        + add another item
      </button>
      {error && <p className="scan-error">{error}</p>}
      <div className="manual-entry-actions">
        <button type="button" className="manual-cancel" onClick={onCancel}>
          cancel
        </button>
        <button type="button" className="manual-submit" disabled={!allValid || saving} onClick={submit}>
          {saving ? "adding..." : "add to fridge"}
        </button>
      </div>
    </div>
  );
}
