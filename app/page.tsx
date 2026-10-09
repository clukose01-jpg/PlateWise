"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Illustrations";
import { syncFromAccount } from "@/lib/account-client";
import { getCurrentPlanId } from "@/lib/device";

// Opening PlateWise goes straight to today's plan, or to making a first plan.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // When she's logged in, her newest plan may have been made on another device.
    syncFromAccount().then(() => {
      const planId = getCurrentPlanId();
      router.replace(planId ? `/plan/${planId}?tab=today` : "/new");
    });
  }, [router]);

  return (
    <main className="splash">
      <Logo />
    </main>
  );
}
