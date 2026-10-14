"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AccountBadge from "@/components/AccountBadge";
import FamilyStep, { type FamilyAnswers } from "@/components/FamilyStep";
import FridgeStep from "@/components/FridgeStep";
import { Logo } from "@/components/Illustrations";
import PlanningWait from "@/components/PlanningWait";
import StepBar from "@/components/StepBar";
import TabBar from "@/components/TabBar";
import { syncFromAccount } from "@/lib/account-client";
import {
  deviceHeaders,
  getCurrentPlanId,
  loadMadePlans,
  loadPantry,
  rememberMadePlan,
  saveOwnerKey,
  savePantry,
  setCurrentPlanId,
} from "@/lib/device";
import { RECENT_PLANS } from "@/lib/plan-schema";
import { ratingsForNextPlan } from "@/lib/ratings";

type Stage = "fridge" | "family" | "planning";

export default function NewPlan() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("fridge");
  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [useSoon, setUseSoon] = useState<string[]>([]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);

  // Pantry staples are remembered on this device, so next week she only photographs the fridge.
  useEffect(() => {
    syncFromAccount().then(() => setPantryItems(loadPantry()));
    // Arriving here right after deleting or removing a plan.
    setCleared(new URLSearchParams(window.location.search).get("cleared"));
  }, []);

  // Saved only when she changes it, so opening the page never overwrites the saved pantry.
  function updatePantry(items: string[]) {
    setPantryItems(items);
    savePantry(items);
  }

  async function makePlan(answers: FamilyAnswers) {
    setError(null);
    setStage("planning");
    window.scrollTo(0, 0);

    const madeOn = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...deviceHeaders() },
        body: JSON.stringify({
          ...answers,
          fridgeItems,
          useSoon: useSoon.filter((item) => fridgeItems.includes(item)),
          pantryItems,
          feedback: ratingsForNextPlan(),
          // Plans on a shared link aren't in her list, so the one she's using counts too.
          recentPlans: [...new Set([getCurrentPlanId(), ...loadMadePlans().map((plan) => plan.id)])]
            .filter((id): id is string => Boolean(id))
            .slice(0, RECENT_PLANS),
          madeOn,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setCurrentPlanId(result.id);
      if (result.ownerKey) saveOwnerKey(result.id, result.ownerKey);
      rememberMadePlan({ id: result.id, madeOn, createdAt: new Date().toISOString() });
      const testMode = new URLSearchParams(window.location.search).has("test");
      router.push(`/plan/${result.id}?tab=week${testMode ? "&test" : ""}`);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
      );
      setStage("family");
    }
  }

  return (
    <main className="new-plan">
      <header>
        <Logo />
        <AccountBadge />
        {stage === "fridge" && (
          <>
            <h1 className="hero">Dinner, decided.</h1>
            <p className="tagline">Plan the whole week of dinners in a few minutes.</p>
          </>
        )}
      </header>

      {cleared && stage === "fridge" && (
        <p className="cleared-notice" role="status">
          {cleared === "account"
            ? "Your account and the plans you made were deleted."
            : cleared === "deleted"
              ? "Your plan was deleted. Make a new one below."
              : "That plan was removed from this device. Make a new one below."}
        </p>
      )}

      <StepBar step={stage === "fridge" ? 1 : stage === "family" ? 2 : 3} />

      {/* Steps are hidden instead of removed, so going back keeps what she entered. */}
      <div hidden={stage !== "fridge"}>
        <FridgeStep
          items={fridgeItems}
          onItemsChange={setFridgeItems}
          useSoon={useSoon}
          onUseSoonChange={setUseSoon}
          pantry={pantryItems}
          onPantryChange={updatePantry}
          onNext={() => {
            setStage("family");
            window.scrollTo(0, 0);
          }}
        />
      </div>

      <div hidden={stage !== "family"}>
        <FamilyStep error={error} onBack={() => setStage("fridge")} onSubmit={makePlan} />
      </div>

      {stage === "planning" && <PlanningWait />}

      {/* Hidden while planning, so leaving the page can't lose the plan being made. */}
      {stage !== "planning" && <TabBar active="new" />}
    </main>
  );
}
