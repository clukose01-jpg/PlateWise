"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

  // Looks like the phone's own opening screen (the app icon and name in the middle), so
  // opening the app doesn't jump from one picture to another.
  return (
    <main className="splash">
      <img src="/icons/icon-512.png" alt="" width={144} height={144} />
      <span>PlateWise</span>
    </main>
  );
}
