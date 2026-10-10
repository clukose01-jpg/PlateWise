"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Cooked, type CookedStatus, SKIP_REASONS, type SkipReason } from "@/lib/cooked";
import { clearPlanTicks, deviceHeaders } from "@/lib/device";
import { dollars } from "@/lib/plan-schema";
import type { StoredPlan } from "@/lib/plans";
import { type DinnerRating, loadRating, removeRating, saveRating } from "@/lib/ratings";
import DishPhoto from "./DishPhoto";
import { ClockIcon, SwapIcon, ThumbIcon } from "./Illustrations";

// To the nearest 50 cents, like "$3" or "$2.50".
function perPerson(cost: number, people: number) {
  const each = Math.round((cost / people) * 2) / 2;
  if (each < 1) return "under $1";
  return Number.isInteger(each) ? `$${each}` : `$${each.toFixed(2)}`;
}

type Props = {
  planId: string;
  dinner: StoredPlan["plan"]["dinners"][number];
  index: number;
  // How many people are eating, for the cost per person.
  people: number;
  // Whether the family made it, saved on the plan.
  cooked?: Cooked | null;
  // The Today tab opens tonight's dinner straight away, with its picture if pictures are on.
  startOpen?: boolean;
  showPhoto?: boolean;
};

export default function DinnerCard({
  planId,
  dinner,
  index,
  people,
  cooked = null,
  startOpen = false,
  showPhoto = false,
}: Props) {
  const router = useRouter();
  const [rating, setRating] = useState<DinnerRating | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [justSwapped, setJustSwapped] = useState(false);
  const [status, setStatus] = useState<CookedStatus | null>(cooked?.status ?? null);
  const [reason, setReason] = useState<SkipReason | undefined>(cooked?.reason);
  const [cookedError, setCookedError] = useState<string | null>(null);
  // Plans made before prices were added have no cost.
  const cost = dinner.cost && dinner.cost > 0 ? dinner.cost : null;

  useEffect(() => {
    const saved = loadRating(planId, dinner.day);
    setRating(saved);
    // Dinners rated before "We made it" existed were made.
    if (saved && !cooked) setStatus("made");
  }, [planId, dinner.day, cooked]);

  // "We made it" or "We skipped it", saved on the plan so it counts for the whole family.
  async function markCooked(next: CookedStatus, nextReason?: SkipReason) {
    const before = { status, reason };
    setStatus(next);
    setReason(nextReason);
    setCookedError(null);
    // A skipped dinner wasn't eaten, so it isn't rated.
    if (next === "skipped" && rating) {
      removeRating(planId, dinner.day);
      setRating(null);
    }
    try {
      const response = await fetch(`/api/plan/${planId}/cooked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: dinner.day, status: next, reason: nextReason }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error);
    } catch (err) {
      setStatus(before.status);
      setReason(before.reason);
      setCookedError(err instanceof Error && err.message ? err.message : "We couldn't save that. Please try again.");
    }
  }

  function rate(liked: boolean) {
    // Tapping the same choice again clears it.
    if (rating?.liked === liked) {
      removeRating(planId, dinner.day);
      setRating(null);
      return;
    }
    const next: DinnerRating = {
      planId,
      day: dinner.day,
      dish: dinner.name,
      liked,
      note: rating?.note ?? "",
      ratedAt: Date.now(),
    };
    saveRating(next);
    setRating(next);
  }

  async function swap() {
    setSwapping(true);
    setSwapError(null);
    try {
      const response = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...deviceHeaders() },
        body: JSON.stringify({ planId, day: dinner.day }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      // The old rating was for the old dinner, and the grocery and prep lists have changed.
      removeRating(planId, dinner.day);
      setRating(null);
      setStatus(null);
      setReason(undefined);
      clearPlanTicks(planId);
      setJustSwapped(true);
      router.refresh();
    } catch (err) {
      setSwapError(
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSwapping(false);
    }
  }

  function updateNote(note: string) {
    if (!rating) return;
    const next = { ...rating, note };
    saveRating(next);
    setRating(next);
  }

  return (
    <details className="card dinner" open={startOpen || undefined}>
      <summary>
        <span className={`day-badge day-${index}`}>{dinner.day.slice(0, 3)}</span>
        <span className="dish-info">
          <span className="dish">{dinner.name}</span>
          <span className="minutes">
            <ClockIcon /> {dinner.minutes} min
            {cost !== null && <> · about {dollars(cost)}</>}
          </span>
        </span>
        {rating && (
          <span
            className={rating.liked ? "rated liked" : "rated"}
            aria-label={rating.liked ? "You liked this" : "Not for you"}
          >
            <ThumbIcon down={!rating.liked} />
          </span>
        )}
        <span className="chevron" aria-hidden="true" />
      </summary>
      {showPhoto && <DishPhoto key={dinner.name} planId={planId} day={dinner.day} name={dinner.name} />}
      {justSwapped && (
        <p className="swapped">New dinner! Your grocery list and Sunday prep were updated to match.</p>
      )}
      {cost !== null && (
        <p className="dinner-cost">
          About {dollars(cost)} for the family{people > 1 && `, or ${perPerson(cost, people)} a person`}.
        </p>
      )}
      {dinner.ingredients?.length ? (
        <div className="ingredients">
          <h3>What you need</h3>
          <ul>
            {dinner.ingredients.map((ingredient, j) => (
              <li key={j}>{ingredient}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {dinner.tip && (
        <p className="tip">
          <strong>Tip:</strong> {dinner.tip}
        </p>
      )}
      {/* Plans made before ingredient lists were added just show the steps, as before. */}
      {dinner.ingredients?.length ? <h3 className="steps-title">Steps</h3> : null}
      <ol className="steps">
        {dinner.steps.map((step, j) => (
          <li key={j}>{step}</li>
        ))}
      </ol>

      <div className="swap">
        <button type="button" className="swap-button" onClick={swap} disabled={swapping}>
          <SwapIcon /> {swapping ? "Finding another dinner…" : "Swap for a different dinner"}
        </button>
        {swapping && (
          <p className="hint">This takes under a minute. Your grocery list will update too.</p>
        )}
        {swapError && (
          <p className="error" role="alert">
            {swapError}
          </p>
        )}
      </div>

      <div className="feedback">
        <p className="feedback-title">How did it go?</p>
        <div className="rate-buttons">
          <button
            type="button"
            className={status === "made" ? "thumb chosen" : "thumb"}
            aria-pressed={status === "made"}
            onClick={() => status !== "made" && markCooked("made")}
          >
            We made it
          </button>
          <button
            type="button"
            className={status === "skipped" ? "thumb chosen" : "thumb"}
            aria-pressed={status === "skipped"}
            onClick={() => status !== "skipped" && markCooked("skipped")}
          >
            We skipped it
          </button>
        </div>
        {cookedError && (
          <p className="error" role="alert">
            {cookedError}
          </p>
        )}

        {status === "skipped" && (
          <div className="skip-reasons">
            <p className="hint">What happened? This helps make better plans.</p>
            <div className="reason-pills">
              {SKIP_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={reason === option ? "pill selected" : "pill"}
                  aria-pressed={reason === option}
                  onClick={() => markCooked("skipped", reason === option ? undefined : option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "made" && (
          <>
            <p className="feedback-title liked-question">Did your family like it?</p>
            <div className="rate-buttons">
              <button
                type="button"
                className={rating?.liked === true ? "thumb chosen" : "thumb"}
                aria-pressed={rating?.liked === true}
                onClick={() => rate(true)}
              >
                <ThumbIcon /> Liked it
              </button>
              <button
                type="button"
                className={rating?.liked === false ? "thumb chosen" : "thumb"}
                aria-pressed={rating?.liked === false}
                onClick={() => rate(false)}
              >
                <ThumbIcon down /> Not for us
              </button>
            </div>
          </>
        )}
        {status === "made" && rating && (
          <>
            <textarea
              value={rating.note}
              onChange={(event) => updateNote(event.target.value)}
              placeholder="What did you think? Like “loved the chicken, not the veggies”"
              aria-label={`What you thought of ${dinner.name}`}
              maxLength={300}
              rows={2}
            />
            <p className="hint">Saved. Your next plans will use this.</p>
          </>
        )}
      </div>
    </details>
  );
}
