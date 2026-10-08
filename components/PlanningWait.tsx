"use client";

import { useEffect, useState } from "react";
import { PotDrawing } from "./Illustrations";

const MESSAGES = [
  "Picking dinners everyone will eat…",
  "Checking for allergies…",
  "Fitting each dinner into your cooking time…",
  "Using up what's in your fridge…",
  "Planning your Sunday prep…",
  "Writing your grocery list…",
];

export default function PlanningWait() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="card planning" role="status">
      <PotDrawing />
      <h2>Cooking up your week</h2>
      <p className="planning-message" key={index}>
        {MESSAGES[index]}
      </p>
      <p className="hint">This takes about a minute. Keep this page open.</p>
    </section>
  );
}
