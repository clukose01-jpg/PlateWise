"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { syncFromAccount } from "@/lib/account-client";
import { isNoAllergy, loadFamily, saveFamily, toBudget } from "@/lib/device";
import { COOK_TIMES } from "@/lib/plan-schema";
import { countRatings } from "@/lib/ratings";
import BudgetInput from "./BudgetInput";

export type FamilyAnswers = {
  allergies: string;
  adults: number;
  kids: { name: string; refuses: string }[];
  maxMinutes: number;
  lunches: boolean;
  budget: number | null;
};

const MAX_FOODS_PER_KID = 15;
const MAX_ALLERGIES = 12;

// While she's typing, each kid's foods are separate bubbles plus whatever is in the box.
type KidDraft = { name: string; refuses: string[]; typing: string };

const EMPTY_KID: KidDraft = { name: "", refuses: [], typing: "" };

function addFoods(existing: string[], text: string, max = MAX_FOODS_PER_KID): string[] {
  const foods = [...existing];
  for (const raw of text.split(",")) {
    const food = raw.trim();
    if (food && foods.length < max && !foods.some((f) => f.toLowerCase() === food.toLowerCase())) {
      foods.push(food);
    }
  }
  return foods;
}

// Typing "none" just means no allergies, so it doesn't become a bubble.
function addAllergies(existing: string[], text: string) {
  return addFoods(existing, text, MAX_ALLERGIES).filter((allergy) => !isNoAllergy(allergy));
}

type Props = {
  error: string | null;
  onBack: () => void;
  onSubmit: (answers: FamilyAnswers) => void;
};

export default function FamilyStep({ error, onBack, onSubmit }: Props) {
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyTyping, setAllergyTyping] = useState("");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState<KidDraft[]>([EMPTY_KID]);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [lunches, setLunches] = useState(false);
  const [budget, setBudget] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [ratingCount, setRatingCount] = useState(0);

  useEffect(() => {
    setRatingCount(countRatings());
    // Answers are remembered on this device (and her account), so next Sunday she doesn't retype them.
    syncFromAccount().then(() => {
      const saved = loadFamily();
      if (!saved) return;
      setAllergies(saved.allergies);
      setAdults(saved.adults);
      setKids(saved.kids.length ? saved.kids.map((kid) => ({ ...kid, typing: "" })) : [EMPTY_KID]);
      setMaxMinutes(saved.maxMinutes);
      setLunches(saved.lunches);
      setBudget(saved.budget ? String(saved.budget) : "");
    });
  }, []);

  function updateKid(index: number, changes: Partial<KidDraft>) {
    setKids(kids.map((kid, i) => (i === index ? { ...kid, ...changes } : kid)));
  }

  function addTypedFoods(index: number) {
    const kid = kids[index];
    updateKid(index, { refuses: addFoods(kid.refuses, kid.typing), typing: "" });
  }

  // Enter or a comma adds the food, instead of sending the whole form.
  function onFoodKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTypedFoods(index);
    }
  }

  function removeFood(index: number, food: string) {
    updateKid(index, { refuses: kids[index].refuses.filter((f) => f !== food) });
  }

  function addTypedAllergies() {
    setAllergies(addAllergies(allergies, allergyTyping));
    setAllergyTyping("");
  }

  // Enter or a comma adds the allergy, instead of sending the whole form.
  function onAllergyKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTypedAllergies();
    }
  }

  function removeKid(index: number) {
    setKids(kids.filter((_, i) => i !== index));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Include anything still in a box that she didn't tap Add for.
    const allergyList = addAllergies(allergies, allergyTyping);
    const finished = kids
      .map((kid) => ({ name: kid.name.trim(), refuses: addFoods(kid.refuses, kid.typing) }))
      .filter((kid) => kid.name || kid.refuses.length);
    const answers: FamilyAnswers = {
      allergies: allergyList.join(", "),
      adults,
      kids: finished.map((kid) => ({ name: kid.name, refuses: kid.refuses.join(", ") })),
      maxMinutes,
      lunches,
      budget: toBudget(budget),
    };
    saveFamily({ allergies: allergyList, adults, kids: finished, maxMinutes, lunches, budget: answers.budget });
    onSubmit(answers);
  }

  return (
    <form className="card family" onSubmit={submit}>
      <h2>About your family</h2>
      <p>Three quick questions. This device will remember your answers for next week.</p>

      <label className="question" htmlFor="allergies">
        <span className="number">1</span>
        Any food allergies?
      </label>
      {allergies.length > 0 && (
        <ul className="items refuses allergy-list">
          {allergies.map((allergy) => (
            <li key={allergy}>
              <span>{allergy}</span>
              <button
                type="button"
                aria-label={`Remove ${allergy} allergy`}
                onClick={() => setAllergies(allergies.filter((a) => a !== allergy))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {allergies.length < MAX_ALLERGIES && (
        <div className="add">
          <input
            id="allergies"
            value={allergyTyping}
            onChange={(event) => setAllergyTyping(event.target.value)}
            onKeyDown={onAllergyKey}
            placeholder={allergies.length ? "Add another allergy" : "Like peanuts. Leave blank if none."}
            maxLength={40}
            enterKeyHint="done"
          />
          <button type="button" onClick={addTypedAllergies} aria-label="Add allergy">
            Add
          </button>
        </div>
      )}

      <fieldset>
        <legend className="question">
          <span className="number">2</span>
          Who&apos;s eating?
        </legend>
        <label className="inline">
          Adults
          <select value={adults} onChange={(event) => setAdults(Number(event.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {kids.map((kid, i) => (
          <div className="kid" key={i}>
            <div className="kid-fields">
              <input
                value={kid.name}
                onChange={(event) => updateKid(i, { name: event.target.value })}
                placeholder="Kid's name or age"
                aria-label={`Kid ${i + 1} name or age`}
              />
              {kid.refuses.length > 0 && (
                <ul className="items refuses">
                  {kid.refuses.map((food) => (
                    <li key={food}>
                      <span>{food}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${food} for kid ${i + 1}`}
                        onClick={() => removeFood(i, food)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="add">
                <input
                  value={kid.typing}
                  onChange={(event) => updateKid(i, { typing: event.target.value })}
                  onKeyDown={(event) => onFoodKey(i, event)}
                  placeholder={kid.refuses.length ? "Add another food" : "Won't eat… (like fish)"}
                  aria-label={`Food kid ${i + 1} won't eat`}
                  enterKeyHint="done"
                />
                <button type="button" onClick={() => addTypedFoods(i)} aria-label={`Add food for kid ${i + 1}`}>
                  Add
                </button>
              </div>
            </div>
            <button
              type="button"
              className="remove-kid"
              aria-label={`Remove kid ${i + 1}`}
              onClick={() => removeKid(i)}
            >
              ×
            </button>
          </div>
        ))}
        {kids.length < 8 && (
          <button type="button" className="link left" onClick={() => setKids([...kids, EMPTY_KID])}>
            + Add a kid
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend className="question">
          <span className="number">3</span>
          Longest you&apos;ll cook on a weeknight?
        </legend>
        <div className="pills">
          {COOK_TIMES.map((minutes) => (
            <label key={minutes} className={maxMinutes === minutes ? "pill selected" : "pill"}>
              <input
                type="radio"
                name="maxMinutes"
                value={minutes}
                checked={maxMinutes === minutes}
                onChange={() => setMaxMinutes(minutes)}
              />
              {minutes} min
            </label>
          ))}
        </div>
      </fieldset>

      <label className="checkbox">
        <input type="checkbox" checked={lunches} onChange={(event) => setLunches(event.target.checked)} />
        Plan lunches too
      </label>

      {/* Usually set when she makes an account, so here it's one small line she can change. */}
      <div className="budget-row">
        {editingBudget ? (
          <>
            <label htmlFor="budget">Weekly grocery budget</label>
            <div className="budget-edit">
              <BudgetInput
                id="budget"
                value={budget}
                onChange={setBudget}
                onDone={() => setEditingBudget(false)}
                autoFocus
              />
              <button type="button" className="budget-done" onClick={() => setEditingBudget(false)}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <span>
              Weekly grocery budget: <strong>{toBudget(budget) ? `$${toBudget(budget)}` : "none"}</strong>
            </span>
            <button type="button" className="link" onClick={() => setEditingBudget(true)}>
              {toBudget(budget) ? "Change" : "Add one"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {ratingCount > 0 && (
        <p className="hint ratings-used">
          We&apos;ll use your ratings of {ratingCount} past dinner{ratingCount === 1 ? "" : "s"} to
          pick meals you&apos;ll like.
        </p>
      )}

      <button type="submit" className="primary next-step">
        Make my plan
      </button>
      <button type="button" className="link" onClick={onBack}>
        Back to the fridge
      </button>
    </form>
  );
}
