"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FamilyStep, { type FamilyAnswers } from "@/components/FamilyStep";
import FridgeStep from "@/components/FridgeStep";
import { Logo } from "@/components/Illustrations";
import PlanningWait from "@/components/PlanningWait";
import StepBar from "@/components/StepBar";
import TabBar from "@/components/TabBar";
import { loadPantry, savePantry, setCurrentPlanId } from "@/lib/device";
import { ratingsForNextPlan } from "@/lib/ratings";

type Stage = "fridge" | "family" | "planning";

export default function NewPlan() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("fridge");
  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pantry staples are remembered on this device, so next week she only photographs the fridge.
  useEffect(() => {
    setPantryItems(loadPantry());
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...answers,
          fridgeItems,
          pantryItems,
          feedback: ratingsForNextPlan(),
          madeOn,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setCurrentPlanId(result.id);
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
        {stage === "fridge" && (
          <>
            <h1 className="hero">Dinner, decided.</h1>
            <p className="tagline">Plan the whole week of dinners in a few minutes.</p>
          </>
        )}
      </header>

      <StepBar step={stage === "fridge" ? 1 : stage === "family" ? 2 : 3} />

      {/* Steps are hidden instead of removed, so going back keeps what she entered. */}
      <div hidden={stage !== "fridge"}>
        <FridgeStep
          items={fridgeItems}
          onItemsChange={setFridgeItems}
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
