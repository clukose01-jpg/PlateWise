"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { syncFromAccount } from "@/lib/account-client";
import { getCurrentPlanId, loadMadePlans, type PlanRef } from "@/lib/device";

const SHOWN = 10;

// On the More tab: the plans she's made, newest first, so she can look back at an old week.
export default function PlanHistory() {
  const [plans, setPlans] = useState<PlanRef[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    syncFromAccount().then(() => {
      setPlans(loadMadePlans().slice(0, SHOWN));
      setCurrent(getCurrentPlanId());
    });
  }, []);

  if (plans.length < 2) return null;

  return (
    <section className="card">
      <h2 className="section-title">Your plans</h2>
      <ul className="plan-history">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link href={`/plan/${plan.id}?tab=week`}>Made on {plan.madeOn}</Link>
            {plan.id === current && <span className="hint"> · this week</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
