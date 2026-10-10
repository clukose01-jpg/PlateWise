import type { SavedFamily } from "@/lib/device";

// The family's saved answers in a few lines, allergies first.
export default function FamilySummary({ family }: { family: SavedFamily }) {
  return (
    <ul className="family-summary">
      <li>
        <strong>Allergies:</strong> {family.allergies.length ? family.allergies.join(", ") : "none"}
      </li>
      <li>
        <strong>Eating:</strong> {family.adults} adult{family.adults === 1 ? "" : "s"}
        {family.kids.length > 0 && `, ${family.kids.length} kid${family.kids.length === 1 ? "" : "s"}`}
      </li>
      {family.kids.map((kid, i) => (
        <li key={i}>
          <strong>{kid.name || `Kid ${i + 1}`}:</strong>{" "}
          {kid.refuses.length ? `won't eat ${kid.refuses.join(", ")}` : "no foods listed"}
        </li>
      ))}
      <li>
        <strong>Weeknight cooking:</strong> up to {family.maxMinutes} min
      </li>
      <li>
        <strong>Lunches:</strong> {family.lunches ? "planned too" : "not planned"}
      </li>
      <li>
        <strong>Grocery budget:</strong> {family.budget ? `$${family.budget} a week` : "no limit"}
      </li>
    </ul>
  );
}
