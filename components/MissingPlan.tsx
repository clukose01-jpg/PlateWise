"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetPlan, getCurrentPlanId, loadMadePlans } from "@/lib/device";
import { Logo } from "./Illustrations";

// A plan link that doesn't work any more, usually because the plan was deleted. If this device
// was opening to it, forget it so the app stops landing here, and offer her newest other plan.
export default function MissingPlan({ id }: { id: string }) {
  const [newest, setNewest] = useState<string | null>(null);

  useEffect(() => {
    const wasCurrent = getCurrentPlanId() === id;
    if (wasCurrent || loadMadePlans().some((plan) => plan.id === id)) forgetPlan(id);
    setNewest(loadMadePlans().find((plan) => plan.id !== id)?.id ?? null);
  }, [id]);

  return (
    <main>
      <header>
        <Logo />
      </header>
      <section className="card">
        <h2>We couldn&apos;t find that plan</h2>
        <p>It may have been deleted, or the link wasn&apos;t copied in full.</p>
        {newest && (
          <Link href={`/plan/${newest}?tab=today`} className="primary">
            Open my newest plan
          </Link>
        )}
        <Link href="/new" className={newest ? "secondary" : "primary"}>
          Make a new plan
        </Link>
      </section>
    </main>
  );
}
