"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

// A failed save leaves the control on the stored value, which the live query shows again.
const ignoreFailure = () => {};

export function SettingsCard() {
  const settings = useQuery(api.profiles.settings);
  const update = useMutation(api.profiles.updateSettings);
  // Slider value while dragging; saved on release so one drag is one write.
  const [draft, setDraft] = useState<number | null>(null);
  if (settings === undefined) return null;

  const percent = draft ?? Math.round(settings.wastedFraction * 100);
  const saveDraft = () => {
    if (draft === null) return;
    update({ wastedFraction: draft / 100 })
      .catch(ignoreFailure)
      .finally(() => setDraft(null));
  };

  return (
    <section className="settings-card" aria-labelledby="settings-heading">
      <p className="eyebrow" id="settings-heading">
        settings
      </p>
      <label className="setting-row">
        <span>
          <strong>a tossed item counts as {percent}% wasted</strong>
          <small>for items you toss from now on. feeds dollars and pounds wasted.</small>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={saveDraft}
          onKeyUp={saveDraft}
          onBlur={saveDraft}
        />
      </label>
      <label className="setting-row">
        <span>
          <strong>always ask &ldquo;does it look spoiled?&rdquo;</strong>
          <small>shows the second card even when there are no extra days to give.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="pill-toggle"
          checked={settings.alwaysAskSpoiled}
          onChange={(event) => update({ alwaysAskSpoiled: event.target.checked }).catch(ignoreFailure)}
        />
      </label>
    </section>
  );
}
