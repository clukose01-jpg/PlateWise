"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FamilyStep, { type FamilyAnswers } from "@/components/FamilyStep";
import FridgeStep from "@/components/FridgeStep";

type Stage = "fridge" | "family" | "planning";

export default function Home() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("fridge");
  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ ...answers, fridgeItems, madeOn }),
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
        <h1>PlateWise</h1>
        <p className="tagline">Plan the week&apos;s dinners in a few minutes.</p>
      </header>

      {/* Steps are hidden instead of removed, so going back keeps what she entered. */}
      <div hidden={stage !== "fridge"}>
        <FridgeStep
          items={fridgeItems}
          onItemsChange={setFridgeItems}
          onNext={() => {
            setStage("family");
            window.scrollTo(0, 0);
          }}
        />
      </div>

      <div hidden={stage !== "family"}>
        <FamilyStep error={error} onBack={() => setStage("fridge")} onSubmit={makePlan} />
      </div>

      {stage === "planning" && (
        <section className="card planning" role="status">
          <h2>Planning your week…</h2>
          <p>This usually takes a minute or two. Keep this page open.</p>
        </section>
      )}
    </main>
  );
}
