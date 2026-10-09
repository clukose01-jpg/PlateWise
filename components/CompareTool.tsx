"use client";

// A temporary page for deciding whether PlateWise can think less (faster and cheaper) without
// getting allergies or kids' foods wrong. Remove it once the decision is made.

import { useEffect, useRef, useState } from "react";
import { MAX_PHOTOS_PER_SCAN } from "@/lib/photo-limits";
import { resizePhoto } from "@/lib/resize-photo";
import { Logo } from "./Illustrations";

type Effort = "medium" | "low";
const SETTINGS: { effort: Effort; label: string }[] = [
  { effort: "medium", label: "Today's setting" },
  { effort: "low", label: "Faster setting" },
];

const FAMILY_TITLES = [
  "Peanut and tree nut allergy, two picky kids (30 min max)",
  "Dairy and shellfish allergy, one picky kid (20 min max)",
  "Egg and wheat allergy, two picky kids (45 min max)",
];

type Problem = { who: string; food: string; where: string; text: string };
type PlanResult = {
  seconds: number;
  costUsd: number | null;
  dinners: { day: string; name: string; minutes: number }[];
  problems: Problem[];
  tooLong: string[];
  missingDays: string[];
};
type PlanRun = {
  round: number;
  family: number;
  effort: Effort;
  result?: PlanResult;
  error?: string;
};
type ScanResult = { seconds: number; costUsd: number | null; fresh: string[]; pantry: string[] };
type ScanRun = { effort: Effort; result?: ScanResult; error?: string };

const cents = (usd: number | null) => (usd === null ? "?" : `${(usd * 100).toFixed(1)}¢`);
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

function isClean(result: PlanResult) {
  return result.problems.length === 0 && result.tooLong.length === 0 && result.missingDays.length === 0;
}

export default function CompareTool() {
  const [code, setCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [planRuns, setPlanRuns] = useState<PlanRun[]>([]);
  const [scanRuns, setScanRuns] = useState<ScanRun[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get("code") ?? "");
  }, []);

  const plansRunning = planRuns.some((run) => !run.result && !run.error);
  const rounds = planRuns.length ? Math.max(...planRuns.map((run) => run.round)) : 0;

  async function runPlans() {
    const round = rounds + 1;
    const runs: PlanRun[] = FAMILY_TITLES.flatMap((_, family) =>
      SETTINGS.map(({ effort }) => ({ round, family, effort })),
    );
    setPlanRuns((current) => [...current, ...runs]);
    await Promise.all(
      runs.map(async (run) => {
        let update: Partial<PlanRun>;
        try {
          const response = await fetch("/api/compare/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-compare-code": code },
            body: JSON.stringify({ family: run.family, effort: run.effort }),
          });
          const body = await response.json();
          update = response.ok ? { result: body } : { error: body.error ?? "Something went wrong." };
        } catch {
          update = { error: "The connection dropped. Try again." };
        }
        setPlanRuns((current) => current.map((r) => (r === run ? { ...r, ...update } : r)));
      }),
    );
  }

  async function runScan(files: File[]) {
    setScanBusy(true);
    setScanRuns(SETTINGS.map(({ effort }) => ({ effort })));
    const photos = await Promise.all(files.map((file) => resizePhoto(file, files.length > 1 ? 1600 : 2048)));
    await Promise.all(
      SETTINGS.map(async ({ effort }) => {
        const form = new FormData();
        form.append("effort", effort);
        photos.forEach((photo, i) => form.append("photo", photo, `photo-${i + 1}.jpg`));
        let update: Partial<ScanRun>;
        try {
          const response = await fetch("/api/compare/scan", {
            method: "POST",
            headers: { "x-compare-code": code },
            body: form,
          });
          const body = await response.json();
          update = response.ok ? { result: body } : { error: body.error ?? "Something went wrong." };
        } catch {
          update = { error: "The connection dropped. Try again." };
        }
        setScanRuns((current) => current.map((r) => (r.effort === effort ? { ...r, ...update } : r)));
      }),
    );
    setScanBusy(false);
  }

  if (!code) {
    return (
      <main className="compare">
        <header>
          <Logo />
          <h1 className="plan-title">Speed test</h1>
        </header>
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            setCode(codeInput.trim());
          }}
        >
          <p>Enter the passcode for this test.</p>
          <div className="add">
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} aria-label="Passcode" />
            <button type="submit">Go</button>
          </div>
        </form>
      </main>
    );
  }

  const done = planRuns.filter((run) => run.result);

  return (
    <main className="compare">
      <header>
        <Logo />
        <h1 className="plan-title">Speed test</h1>
        <p className="tagline">
          Today&apos;s setting is how PlateWise works now. The faster setting lets the AI think for less time.
          Nothing here is saved, and nobody else sees it.
        </p>
      </header>

      <section className="card">
        <h2 className="section-title">1. Plans</h2>
        <p>
          Makes 6 test plans: 3 families with allergies and picky kids, each made both ways. Every plan is
          checked for foods that family can&apos;t eat. Their own kitchens include some of those foods, to see
          if the AI gets tricked. Takes 1 to 2 minutes and costs about 40 cents.
        </p>
        <button className="primary" onClick={runPlans} disabled={plansRunning}>
          {plansRunning ? "Making plans…" : rounds ? "Run it again for more results" : "Run the plan test"}
        </button>

        {done.length > 0 && (
          <div className="compare-columns compare-summary">
            {SETTINGS.map(({ effort, label }) => {
              const results = done.filter((run) => run.effort === effort).map((run) => run.result!);
              if (!results.length) return <div key={effort} />;
              const clean = results.filter(isClean).length;
              return (
                <div key={effort}>
                  <h3>{label}</h3>
                  <p className="compare-big">{Math.round(average(results.map((r) => r.seconds)))} seconds</p>
                  <p>
                    {cents(average(results.map((r) => r.costUsd ?? 0)))} per plan on average ({results.length}{" "}
                    plans)
                  </p>
                  <p className={clean === results.length ? "compare-pass" : "compare-fail"}>
                    {clean} of {results.length} plans followed every rule
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {FAMILY_TITLES.map((title, family) => {
        const runs = planRuns.filter((run) => run.family === family);
        if (!runs.length) return null;
        return (
          <section className="card" key={title}>
            <h2 className="section-title">{title}</h2>
            <div className="compare-columns">
              {SETTINGS.map(({ effort, label }) => (
                <div key={effort}>
                  {runs
                    .filter((run) => run.effort === effort)
                    .map((run) => (
                      <PlanRunView key={run.round} run={run} label={label} showRound={rounds > 1} />
                    ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card">
        <h2 className="section-title">2. Photo scan</h2>
        <p>
          Pick 1 to {MAX_PHOTOS_PER_SCAN} photos of a fridge, freezer or pantry. They&apos;re read both ways so
          you can see what each one finds. Costs a few cents.
        </p>
        <button className="primary" onClick={() => photoInput.current?.click()} disabled={scanBusy}>
          {scanBusy ? "Reading photos…" : scanRuns.length ? "Try other photos" : "Choose photos"}
        </button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS_PER_SCAN);
            event.target.value = "";
            if (files.length) runScan(files);
          }}
        />
        {scanRuns.length > 0 && (
          <div className="compare-columns">
            {SETTINGS.map(({ effort, label }) => {
              const run = scanRuns.find((r) => r.effort === effort);
              const other = scanRuns.find((r) => r.effort !== effort)?.result;
              const otherFoods = other ? [...other.fresh, ...other.pantry].map((f) => f.toLowerCase()) : null;
              return (
                <div key={effort}>
                  <h3>{label}</h3>
                  {run?.error && <p className="error">{run.error}</p>}
                  {!run?.result && !run?.error && <p className="quiet">Reading…</p>}
                  {run?.result && (
                    <>
                      <p className="hint">
                        {Math.round(run.result.seconds)} seconds · {cents(run.result.costUsd)} ·{" "}
                        {run.result.fresh.length + run.result.pantry.length} foods
                      </p>
                      <ul className="compare-foods">
                        {[...run.result.fresh, ...run.result.pantry].map((food) => (
                          <li key={food}>
                            {food}
                            {otherFoods && !otherFoods.includes(food.toLowerCase()) && (
                              <span className="compare-only"> only here</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function PlanRunView({ run, label, showRound }: { run: PlanRun; label: string; showRound: boolean }) {
  const heading = showRound ? `${label}, try ${run.round}` : label;
  if (run.error) {
    return (
      <div className="compare-run">
        <h3>{heading}</h3>
        <p className="error">{run.error}</p>
      </div>
    );
  }
  if (!run.result) {
    return (
      <div className="compare-run">
        <h3>{heading}</h3>
        <p className="quiet planning-message">Making the plan…</p>
      </div>
    );
  }
  const { seconds, costUsd, dinners, problems, tooLong, missingDays } = run.result;
  return (
    <div className="compare-run">
      <h3>{heading}</h3>
      <p className="hint">
        {Math.round(seconds)} seconds · {cents(costUsd)}
      </p>
      <ul className="compare-dinners">
        {dinners.map((dinner) => (
          <li key={dinner.day}>
            <strong>{dinner.day.slice(0, 3)}</strong> {dinner.name} · {dinner.minutes} min
          </li>
        ))}
      </ul>
      {isClean(run.result) ? (
        <p className="compare-pass">Followed every rule: no problem foods, every dinner on time.</p>
      ) : (
        <ul className="compare-problems">
          {problems.map((problem, i) => (
            <li key={i}>
              <strong>{problem.who}:</strong> “{problem.food}” in {problem.where}: <em>{problem.text}</em>
            </li>
          ))}
          {tooLong.length > 0 && (
            <li>
              <strong>Too long:</strong> {tooLong.join(", ")}
            </li>
          )}
          {missingDays.length > 0 && (
            <li>
              <strong>Missing:</strong> {missingDays.join(", ")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
