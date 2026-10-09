import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Checklist from "@/components/Checklist";
import DinnerCard from "@/components/DinnerCard";
import { Logo } from "@/components/Illustrations";
import ShareButton from "@/components/ShareButton";
import { WEEKDAYS } from "@/lib/plan-schema";
import { loadPlan, prepGroups } from "@/lib/plans";

export const metadata: Metadata = {
  title: "This week's dinners · PlateWise",
  // Plans are private links, so keep them out of search engines.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanPage({ params, searchParams }: Props) {
  const { id } = await params;
  const saved = await loadPlan(id);
  if (!saved) notFound();

  const { family, plan, test } = saved;
  const testMode = "test" in (await searchParams);

  const plannedAround = [
    family.allergies && `Allergies: ${family.allergies}`,
    ...family.kids
      .filter((kid) => kid.refuses.trim())
      .map((kid) => `${kid.name.trim() || "One kid"} won't eat ${kid.refuses.trim()}`),
  ].filter(Boolean);

  return (
    <main>
      <header>
        <Link href="/" aria-label="PlateWise home">
          <Logo />
        </Link>
        <h1 className="plan-title">Your week of dinners</h1>
        {family.madeOn && <p className="tagline">Made on {family.madeOn}</p>}
      </header>

      <ShareButton />

      {plannedAround.length > 0 && (
        <section className="planned-around">
          <h2 className="section-title">
            Planned around
          </h2>
          <ul>
            {plannedAround.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title">
          Dinners
        </h2>
        {plan.dinners.map((dinner, i) => (
          <DinnerCard key={dinner.day} planId={id} dinner={dinner} index={i} />
        ))}
        <p className="hint">Tap a dinner to see how to make it, and rate it after you eat.</p>
      </section>

      {plan.lunches.length > 0 && (
        <section className="card">
          <h2 className="section-title">
            Lunches
          </h2>
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

      <section className="card">
        <h2 className="section-title">
          Sunday prep
        </h2>
        {prepGroups(plan).map((group) => (
          <div className="prep-day" key={group.day || "all"}>
            {group.day && (
              <h3>
                <span
                  className={`day-badge small day-${WEEKDAYS.indexOf(group.day as (typeof WEEKDAYS)[number])}`}
                >
                  {group.day.slice(0, 3)}
                </span>
                For {group.day}
              </h3>
            )}
            <Checklist
              items={group.steps}
              storageKey={group.day ? `platewise.${id}.prep.${group.day}` : `platewise.${id}.prep`}
            />
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="section-title">
          Grocery list
        </h2>
        <p className="hint">Tap items as they go in your cart.</p>
        {plan.groceryList.map((group) => (
          <div className="grocery-section" key={group.section}>
            <h3>{group.section}</h3>
            <Checklist items={group.items} storageKey={`platewise.${id}.grocery.${group.section}`} />
          </div>
        ))}
      </section>

      <p className="hint center">Always check food labels for allergens.</p>

      <Link href="/" className="secondary">
        Make a new plan
      </Link>

      {testMode && (
        <p className="test-info">
          Test info: {test.seconds.toFixed(0)}s · {test.inputTokens.toLocaleString()} tokens in ·{" "}
          {test.outputTokens.toLocaleString()} out ·{" "}
          {test.costUsd === null ? "cost unknown" : `≈ $${test.costUsd.toFixed(3)}`} · {test.model}
        </p>
      )}
    </main>
  );
}
