"use client";

import { type FormEvent, useEffect, useState } from "react";
import { COOK_TIMES } from "@/lib/plan-schema";

export type FamilyAnswers = {
  allergies: string;
  adults: number;
  kids: { name: string; refuses: string }[];
  maxMinutes: number;
  lunches: boolean;
};

// Answers are remembered on this phone only, so next Sunday she doesn't retype them.
const SAVED_ANSWERS_KEY = "platewise.family";

const EMPTY_KID = { name: "", refuses: "" };

type Props = {
  error: string | null;
  onBack: () => void;
  onSubmit: (answers: FamilyAnswers) => void;
};

export default function FamilyStep({ error, onBack, onSubmit }: Props) {
  const [allergies, setAllergies] = useState("");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState([EMPTY_KID]);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [lunches, setLunches] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_ANSWERS_KEY) ?? "null");
      if (!saved) return;
      setAllergies(saved.allergies);
      setAdults(saved.adults);
      setKids(saved.kids.length ? saved.kids : [EMPTY_KID]);
      setMaxMinutes(saved.maxMinutes);
      setLunches(saved.lunches);
    } catch {
      // Nothing saved, or this browser blocks storage. Start blank.
    }
  }, []);

  function updateKid(index: number, field: "name" | "refuses", value: string) {
    setKids(kids.map((kid, i) => (i === index ? { ...kid, [field]: value } : kid)));
  }

  function removeKid(index: number) {
    setKids(kids.filter((_, i) => i !== index));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const answers: FamilyAnswers = {
      allergies: allergies.trim(),
      adults,
      kids: kids.filter((kid) => kid.name.trim() || kid.refuses.trim()),
      maxMinutes,
      lunches,
    };
    try {
      localStorage.setItem(SAVED_ANSWERS_KEY, JSON.stringify(answers));
    } catch {
      // Not saved; she'll just answer again next time.
    }
    onSubmit(answers);
  }

  return (
    <form className="card family" onSubmit={submit}>
      <h2>About your family</h2>
      <p>Three quick questions. This phone will remember your answers for next week.</p>

      <label className="question" htmlFor="allergies">
        <span className="number">1</span>
        Any food allergies?
      </label>
      <input
        id="allergies"
        value={allergies}
        onChange={(event) => setAllergies(event.target.value)}
        placeholder="Like peanuts. Leave blank if none."
      />

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
            <input
              value={kid.name}
              onChange={(event) => updateKid(i, "name", event.target.value)}
              placeholder="Kid's name or age"
              aria-label={`Kid ${i + 1} name or age`}
            />
            <input
              value={kid.refuses}
              onChange={(event) => updateKid(i, "refuses", event.target.value)}
              placeholder="Won't eat… (like fish)"
              aria-label={`Foods kid ${i + 1} won't eat`}
            />
            <button type="button" aria-label={`Remove kid ${i + 1}`} onClick={() => removeKid(i)}>
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

      {error && (
        <p className="error" role="alert">
          {error}
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
