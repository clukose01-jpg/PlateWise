"use client";

import { useEffect } from "react";
import { setCurrentPlanId } from "@/lib/device";
import { updateReminderPlan } from "@/lib/push-client";

// Opening a plan makes it this device's plan, so the app opens to it next time.
// That includes a plan link someone else shared.
export default function RememberPlan({ id }: { id: string }) {
  useEffect(() => {
    setCurrentPlanId(id);
    updateReminderPlan(id);
  }, [id]);
  return null;
}
