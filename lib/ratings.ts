// What the family thought of past dinners, saved on this phone.
// The next plan uses these to pick more meals they like.

const RATINGS_KEY = "platewise.ratings";

// How many past ratings to send with a new plan. The newest ones matter most.
const MAX_RATINGS_SENT = 30;

export type DinnerRating = {
  planId: string;
  day: string;
  dish: string;
  liked: boolean;
  note: string;
  ratedAt: number;
};

export type RatingForPlan = {
  dish: string;
  liked: boolean;
  note: string;
  lastPlan: boolean;
};

type SavedRatings = Record<string, DinnerRating>;

function ratingKey(planId: string, day: string) {
  return `${planId}:${day}`;
}

function readAll(): SavedRatings {
  try {
    const saved = JSON.parse(localStorage.getItem(RATINGS_KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function writeAll(ratings: SavedRatings) {
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  } catch {
    // Ratings just won't be remembered.
  }
}

export function loadRating(planId: string, day: string): DinnerRating | null {
  return readAll()[ratingKey(planId, day)] ?? null;
}

export function saveRating(rating: DinnerRating) {
  writeAll({ ...readAll(), [ratingKey(rating.planId, rating.day)]: rating });
}

export function removeRating(planId: string, day: string) {
  const ratings = readAll();
  delete ratings[ratingKey(planId, day)];
  writeAll(ratings);
}

export function countRatings(): number {
  return Object.keys(readAll()).length;
}

// Newest first. Dinners from the most recently rated plan are marked, so they aren't repeated right away.
export function ratingsForNextPlan(): RatingForPlan[] {
  const newestFirst = Object.values(readAll()).sort((a, b) => b.ratedAt - a.ratedAt);
  const lastPlanId = newestFirst[0]?.planId;
  return newestFirst.slice(0, MAX_RATINGS_SENT).map((rating) => ({
    dish: rating.dish.slice(0, 120),
    liked: rating.liked,
    note: rating.note.trim().slice(0, 300),
    lastPlan: rating.planId === lastPlanId,
  }));
}
