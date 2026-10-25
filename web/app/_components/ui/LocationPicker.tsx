import type { Location } from "@/lib/referenceMerge";

const LOCATIONS: Location[] = ["fridge", "freezer", "pantry"];

export function LocationPicker({ value, label, disabled = false, onPick }: {
  value: Location;
  label: string;
  disabled?: boolean;
  onPick: (location: Location) => void;
}) {
  return (
    <div className="location-picker" role="group" aria-label={label}>
      {LOCATIONS.map((loc) => (
        <button
          type="button"
          key={loc}
          className={value === loc ? "is-selected" : ""}
          aria-pressed={value === loc}
          disabled={disabled}
          onClick={() => value !== loc && onPick(loc)}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
