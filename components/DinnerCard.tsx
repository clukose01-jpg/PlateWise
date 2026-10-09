"use client";

import { useEffect, useState } from "react";
import type { StoredPlan } from "@/lib/plans";
import { type DinnerRating, loadRating, removeRating, saveRating } from "@/lib/ratings";
import { ClockIcon, ThumbIcon } from "./Illustrations";

type Props = {
  planId: string;
  dinner: StoredPlan["plan"]["dinners"][number];
  index: number;
  // The Today tab opens tonight's dinner straight away.
  startOpen?: boolean;
};

export default function DinnerCard({ planId, dinner, index, startOpen = false }: Props) {
  const [rating, setRating] = useState<DinnerRating | null>(null);

  useEffect(() => {
    setRating(loadRating(planId, dinner.day));
  }, [planId, dinner.day]);

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
      {dinner.tip && (
        <p className="tip">
          <strong>Tip:</strong> {dinner.tip}
        </p>
      )}
      <ol className="steps">
        {dinner.steps.map((step, j) => (
          <li key={j}>{step}</li>
        ))}
      </ol>

      <div className="feedback">
        <p className="feedback-title">How was it?</p>
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
        {rating && (
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
