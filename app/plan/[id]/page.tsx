import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import { loadPlan } from "@/lib/plans";

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
        <Link href="/" className="brand">
          PlateWise
        </Link>
        <h1 className="plan-title">Dinners for the week</h1>
        {family.madeOn && <p className="tagline">Made on {family.madeOn}</p>}
      </header>

      <ShareButton />

      {plannedAround.length > 0 && (
        <section className="card planned-around">
          <h2>Planned around</h2>
          <ul>
            {plannedAround.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title">Dinners</h2>
        {plan.dinners.map((dinner) => (
          <details className="card dinner" key={dinner.day}>
            <summary>
              <span className="day">{dinner.day}</span>
              <span className="dish">{dinner.name}</span>
              <span className="minutes">{dinner.minutes} min</span>
            </summary>
            {dinner.tip && <p className="tip">Tip: {dinner.tip}</p>}
            <ol>
              {dinner.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
        <p className="hint">Tap a dinner to see the steps.</p>
      </section>

      {plan.lunches.length > 0 && (
        <section className="card">
          <h2>Lunches</h2>
          <ul className="lunches">
            {plan.lunches.map((lunch) => (
              <li key={lunch.day}>
                <span className="day">{lunch.day}</span> {lunch.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Sunday prep</h2>
        <ul className="checklist">
          {plan.prepList.map((task, i) => (
            <li key={i}>{task}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Grocery list</h2>
        {plan.groceryList.map((group) => (
          <div className="grocery-section" key={group.section}>
            <h3>{group.section}</h3>
            <ul className="checklist">
              {group.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="hint">Always check food labels for allergens.</p>

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
