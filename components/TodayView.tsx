"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredPlan } from "@/lib/plans";
import Checklist from "./Checklist";
import DinnerCard from "./DinnerCard";
import { GroceryList, type PrepGroup, PrepList } from "./PlanSections";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  planId: string;
  plan: StoredPlan["plan"];
  prepGroups: PrepGroup[];
  createdAt?: string;
  madeOn: string;
  people: number;
  budget?: number | null;
};

function NewPlanNudge({ title, text }: { title: string; text: string }) {
  return (
    <section className="card nudge">
      <h2>{title}</h2>
      <p>{text}</p>
      <Link href="/new" className="primary">
        Make next week&apos;s plan
      </Link>
    </section>
  );
}

// Shows what matters today. It runs on her phone, so "today" is her day, not the server's.
export default function TodayView({ planId, plan, prepGroups, createdAt, madeOn, people, budget }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) return null;

  const today = DAY_NAMES[now.getDay()];
  const tomorrow = DAY_NAMES[(now.getDay() + 1) % 7];
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  // Plans made before the date was saved count as current.
  const ageDays = createdAt ? (now.getTime() - Date.parse(createdAt)) / DAY_MS : 0;
  // On a weekend, a plan made in the last couple of days is for the coming week.
  const madeForComingWeek = ageDays <= 2;

  const dinnerIndex = plan.dinners.findIndex((dinner) => dinner.day === today);
  const tonight = plan.dinners[dinnerIndex];
  const tomorrowsDinner = plan.dinners.find((dinner) => dinner.day === tomorrow);
  const lunch = plan.lunches.find((item) => item.day === today);

  const headsUp = tomorrowsDinner && (
    <section className="card heads-up">
      <h2 className="section-title">Tonight, for tomorrow</h2>
      <p className="hint">
        Tomorrow: {tomorrowsDinner.name} · {tomorrowsDinner.minutes} min
      </p>
      {tomorrowsDinner.nightBefore?.length ? (
        <Checklist
          items={tomorrowsDinner.nightBefore}
          storageKey={`platewise.${planId}.nightBefore.${tomorrowsDinner.day}`}
        />
      ) : (
        <p className="quiet">Nothing to get ready tonight.</p>
      )}
    </section>
  );

  if (today === "Saturday") {
    return (
      <div className="today">
        <h1 className="plan-title">Shopping day</h1>
        <p className="tagline today-date">{dateLabel}</p>
        {madeForComingWeek ? (
          <>
            <GroceryList planId={planId} groceryList={plan.groceryList} budget={budget} />
            <p className="hint center">Tomorrow is prep day.</p>
          </>
        ) : (
          <NewPlanNudge
            title="Plan next week first"
            text="Make next week's plan, and its grocery list will show up here for your shopping trip."
          />
        )}
      </div>
    );
  }

  if (today === "Sunday") {
    return madeForComingWeek ? (
      <div className="today">
        <h1 className="plan-title">Prep day</h1>
        <p className="tagline today-date">{dateLabel}</p>
        <div className="today-columns">
          <PrepList planId={planId} groups={prepGroups} />
          <div className="today-side">
            {headsUp}
            <Link href={`/plan/${planId}?tab=groceries`} className="secondary">
              See the grocery list
            </Link>
          </div>
        </div>
      </div>
    ) : (
      <div className="today">
        <h1 className="plan-title">New week, new plan</h1>
        <p className="tagline today-date">{dateLabel}</p>
        <NewPlanNudge
          title="Time to plan next week"
          text="It takes a few minutes. Your pantry, your family's answers and your ratings are already saved."
        />
      </div>
    );
  }

  return (
    <div className="today">
      <h1 className="plan-title">Tonight</h1>
      <p className="tagline today-date">{dateLabel}</p>
      {ageDays > 7 && (
        <NewPlanNudge
          title="This plan is from last week"
          text={`It was made on ${madeOn}. Make a new one for this week?`}
        />
      )}
      {/* On a computer, tonight's recipe fills the left and the rest sits beside it. */}
      <div className="today-columns">
        {tonight ? (
          <DinnerCard planId={planId} dinner={tonight} index={dinnerIndex} people={people} startOpen />
        ) : (
          <p className="quiet">No dinner is planned for tonight.</p>
        )}
        {(lunch || headsUp) && (
          <div className="today-side">
            {lunch && (
              <section className="card">
                <h2 className="section-title">Today&apos;s lunch</h2>
                <p className="lunch-today">{lunch.name}</p>
              </section>
            )}
            {headsUp}
          </div>
        )}
      </div>
    </div>
  );
}
