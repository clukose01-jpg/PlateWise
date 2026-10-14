"use client";

import { useEffect } from "react";
import { setCurrentPlanId } from "@/lib/device";
import { savePlanForOffline } from "@/lib/offline";
import { updateReminderPlan } from "@/lib/push-client";

// Opening a plan makes it this device's plan, so the app opens to it next time.
// That includes a plan link someone else shared. Its tabs are saved to open without signal.
export default function RememberPlan({ id }: { id: string }) {
  useEffect(() => {
    setCurrentPlanId(id);
    updateReminderPlan(id);
    savePlanForOffline(id);
  }, [id]);
  return null;
}
