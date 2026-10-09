"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Illustrations";
import { getCurrentPlanId } from "@/lib/device";

// Opening PlateWise goes straight to today's plan, or to making a first plan.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const planId = getCurrentPlanId();
    router.replace(planId ? `/plan/${planId}?tab=today` : "/new");
  }, [router]);

  return (
    <main className="splash">
      <Logo />
    </main>
  );
}
