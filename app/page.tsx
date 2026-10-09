"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FamilyStep, { type FamilyAnswers } from "@/components/FamilyStep";
import FridgeStep from "@/components/FridgeStep";
import { Logo } from "@/components/Illustrations";
import PlanningWait from "@/components/PlanningWait";
import StepBar from "@/components/StepBar";
import { ratingsForNextPlan } from "@/lib/ratings";

type Stage = "fridge" | "family" | "planning";

// Pantry staples are remembered on this phone, so next week she only photographs the fridge.
const PANTRY_KEY = "platewise.pantry";

export default function Home() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("fridge");
  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let saved: string[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(PANTRY_KEY) ?? "[]");
      if (Array.isArray(parsed)) {
        saved = parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      // Nothing saved, or this browser blocks storage.
    }
    setPantryItems(saved);
  }, []);

  // Saved only when she changes it, so opening the page never overwrites the saved pantry.
  function updatePantry(items: string[]) {
    setPantryItems(items);
    try {
      localStorage.setItem(PANTRY_KEY, JSON.stringify(items));
    } catch {
      // The pantry just won't be remembered.
    }
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

      const testMode = new URLSearchParams(window.location.search).has("test");
      router.push(`/plan/${result.id}${testMode ? "?test" : ""}`);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
      );
      setStage("family");
    }
  }

  return (
    <main>
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
    </main>
  );
}
