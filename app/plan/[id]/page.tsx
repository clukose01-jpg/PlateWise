import type { Metadata } from "next";
import AccountBadge from "@/components/AccountBadge";
import DeletePlan from "@/components/DeletePlan";
import DinnerCard from "@/components/DinnerCard";
import LoginNudge from "@/components/LoginNudge";
import MissingPlan from "@/components/MissingPlan";
import { Logo } from "@/components/Illustrations";
import { GroceryList, PrepList } from "@/components/PlanSections";
import RememberPlan from "@/components/RememberPlan";
import ShareButton from "@/components/ShareButton";
import TabBar from "@/components/TabBar";
import TodayView from "@/components/TodayView";
import { loadPlan, prepGroups, type StoredPlan } from "@/lib/plans";

export const metadata: Metadata = {
  title: "This week's dinners · PlateWise",
  // Plans are private links, so keep them out of search engines.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PlanTab = "today" | "week" | "groceries";

// Up to 3 dishes, each once, in the order given.
function firstDishes(dishes: string[]) {
  const seen = new Set<string>();
  return dishes
    .filter((dish) => {
      const key = dish.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

// "Tuesdays and Thursdays".
function nights(days: string[]) {
  const plural = days.map((day) => `${day}s`);
  return plural.length > 1 ? `${plural.slice(0, -1).join(", ")} and ${plural.at(-1)}` : plural[0];
}

// What this plan learned from the family's ratings and what they did with past plans.
function whatWeLearned(family: StoredPlan["family"]) {
  const feedback = family.feedback ?? [];
  const learned = family.learned;
  const liked = firstDishes(feedback.filter((rating) => rating.liked).map((rating) => rating.dish));
  const notForThem = firstDishes([
    ...feedback.filter((rating) => !rating.liked).map((rating) => rating.dish),
    ...(learned?.passedOn ?? []),
  ]);
  return [
    liked.length ? `Your family liked ${liked.join(", ")}` : "",
    notForThem.length ? `Steering away from ${notForThem.join(", ")}` : "",
    learned?.busyNights.length ? `Busy ${nights(learned.busyNights)}, so quicker dinners those nights` : "",
    learned?.missingIngredient ? "Sticking closer to food you already have" : "",
  ].filter(Boolean);
}

export default async function PlanPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const saved = await loadPlan(id);
  if (!saved) return <MissingPlan id={id} />;

  const { family, plan, test, createdAt, safetyChecked } = saved;
  const tab: PlanTab = query.tab === "week" || query.tab === "groceries" ? query.tab : "today";
  const testMode = "test" in query;
  const prep = prepGroups(plan);
  const people = family.adults + family.kids.length;

  const plannedAround = [
    family.allergies && `Allergies: ${family.allergies}`,
    ...family.kids
      .filter((kid) => kid.refuses.trim())
      .map((kid) => `${kid.name.trim() || "One kid"} won't eat ${kid.refuses.trim()}`),
  ].filter(Boolean);
  const learnedLines = whatWeLearned(family);

  return (
    <main>
      <RememberPlan id={id} />
      <header>
        <Logo />
        <AccountBadge />
        {tab === "week" && (
          <>
            <h1 className="plan-title">Your week of dinners</h1>
            {family.madeOn && <p className="tagline">Made on {family.madeOn}</p>}
          </>
        )}
        {tab === "groceries" && <h1 className="plan-title">Groceries and prep</h1>}
      </header>

      {tab === "today" && (
        <TodayView
          planId={id}
          plan={plan}
          prepGroups={prep}
          createdAt={createdAt}
          madeOn={family.madeOn}
          people={people}
          budget={family.budget}
          cooked={saved.cooked}
        />
      )}

      {/* On a computer, sharing and "planned around" sit to the right of the dinners. */}
      {tab === "week" && (
        <div className="week-layout">
          <div className="week-side">
            <ShareButton />

            {(plannedAround.length > 0 || learnedLines.length > 0) && (
              <section className="planned-around">
                {plannedAround.length > 0 && (
                  <>
                    <h2 className="section-title">Planned around</h2>
                    <ul>
                      {plannedAround.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    {safetyChecked && (
                      <p className="checked-note">
                        Every dinner was double-checked for these. Always check food labels too, since brands
                        differ.
                      </p>
                    )}
                  </>
                )}
                {learnedLines.length > 0 && (
                  <>
                    <h2 className="section-title">Learned from past weeks</h2>
                    <ul>
                      {learnedLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            <LoginNudge planId={id} />
          </div>

          <div className="week-main">
            <section>
              <h2 className="section-title">Dinners</h2>
              {plan.dinners.map((dinner, i) => (
                <DinnerCard
                  key={dinner.day}
                  planId={id}
                  dinner={dinner}
                  index={i}
                  people={people}
                  cooked={saved.cooked?.[dinner.day]}
                  otherDinners={plan.dinners
                    .filter((other) => other.day !== dinner.day)
                    .map((other) => ({ day: other.day, name: other.name, nightBefore: other.nightBefore }))}
                />
              ))}
              <p className="hint">Tap a dinner to see how to make it, and rate it after you eat.</p>
            </section>

            {plan.lunches.length > 0 && (
              <section className="card">
                <h2 className="section-title">Lunches</h2>
                <ul className="lunches">
                  {plan.lunches.map((lunch, i) => (
                    <li key={lunch.day}>
                      <span className={`day-badge small day-${i}`}>{lunch.day.slice(0, 3)}</span>
                      {lunch.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {testMode && (
              <p className="test-info">
                Test info: {test.seconds.toFixed(0)}s · {test.inputTokens.toLocaleString()} tokens in ·{" "}
                {test.outputTokens.toLocaleString()} out ·{" "}
                {test.costUsd === null ? "cost unknown" : `≈ $${test.costUsd.toFixed(3)}`} · {test.model}
              </p>
            )}

            <DeletePlan planId={id} />
          </div>
        </div>
      )}

      {tab === "groceries" && (
        <>
          <div className="groceries-layout">
            <GroceryList
              planId={id}
              groceryList={plan.groceryList}
              budget={family.budget}
              shared={plan.sharedIngredients}
            />
            <PrepList planId={id} groups={prep} />
          </div>
          <p className="hint center">Always check food labels for allergens.</p>
        </>
      )}

      <TabBar active={tab} planId={id} />
    </main>
  );
}
