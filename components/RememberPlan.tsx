"use client";

import { useEffect } from "react";
import { setCurrentPlanId } from "@/lib/device";

// Opening a plan makes it this phone's plan, so the app opens to it next time.
// That includes a plan link someone else shared.
export default function RememberPlan({ id }: { id: string }) {
  useEffect(() => {
    setCurrentPlanId(id);
  }, [id]);
  return null;
}
