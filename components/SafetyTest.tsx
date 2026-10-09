"use client";

// Part of the temporary speed test page: runs test families through the allergy safety check
// exactly as the app will, and shows what it caught, what it fixed, and the final plans.

import { useState } from "react";
import { TEST_FAMILIES } from "@/lib/compare";

type Problem = { who: string; food: string; where: string; text: string };
type Round = { checkedBy: "words" | "review"; problems: Problem[] };
type SafeResult = {
  seconds: number;
  costUsd?: number | null;
  rounds: Round[];
  blocked?: boolean;
  dinners?: { day: string; name: string; minutes: number }[];
  problems?: Problem[];
  tooLong?: string[];
  missingDays?: string[];
};
type SafeRun = { round: number; family: number; result?: SafeResult; error?: string };

const cents = (usd: number | null | undefined) => (usd == null ? "?" : `${(usd * 100).toFixed(1)}¢`);

function finalIsClean(result: SafeResult) {
  return !result.blocked && !result.problems?.length && !result.tooLong?.length && !result.missingDays?.length;
}

function fixes(result: SafeResult) {
  return result.rounds.filter((round) => round.problems.length).length;
}

export default function SafetyTest({ code }: { code: string }) {
  const [runs, setRuns] = useState<SafeRun[]>([]);
  const running = runs.some((run) => !run.result && !run.error);
  const rounds = runs.length ? Math.max(...runs.map((run) => run.round)) : 0;
  const done = runs.filter((run) => run.result).map((run) => run.result!);

  async function runTest() {
    const round = rounds + 1;
    const fresh: SafeRun[] = TEST_FAMILIES.map((_, family) => ({ round, family }));
    setRuns((current) => [...current, ...fresh]);
    await Promise.all(
      fresh.map(async (run) => {
        let update: Partial<SafeRun>;
        try {
          const response = await fetch("/api/compare/safe", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-compare-code": code },
            body: JSON.stringify({ family: run.family }),
          });
          const body = await response.json();
          update = response.ok ? { result: body } : { error: body.error ?? "Something went wrong." };
        } catch {
          update = { error: "The connection dropped. Try again." };
        }
        setRuns((current) => current.map((r) => (r === run ? { ...r, ...update } : r)));
      }),
    );
  }

  const shown = done.filter((result) => !result.blocked);
  const blocked = done.filter((result) => result.blocked).length;
  const errors = runs.filter((run) => run.error).length;

  return (
    <>
      <section className="card safety-test">
        <h2 className="section-title">1. Safety check (run this one)</h2>
        <p>
          Makes {TEST_FAMILIES.length} test plans the way PlateWise will once the safety check is on: the faster
          setting, then a word check and a second careful AI review, with automatic fixes for anything they
          find. Each family&apos;s own kitchen has foods they can&apos;t eat in it. At the end, every final plan
          is checked once more with a separate list. Takes 1 to 3 minutes and costs about $1.
        </p>
        <button className="primary" onClick={runTest} disabled={running}>
          {running ? "Making and checking plans…" : rounds ? "Run it again for more results" : "Run the safety check"}
        </button>
        {done.length > 0 && (
          <div className="compare-summary safety-summary">
            <div>
              <p className={shown.every(finalIsClean) ? "compare-pass" : "compare-fail"}>
                {shown.filter(finalIsClean).length} of {shown.length} plans shown to a family followed every rule
              </p>
              <p>
                {done.filter((result) => fixes(result) > 0).length} were fixed by the safety check first.{" "}
                {blocked > 0 && `${blocked} couldn't be made safe, so the family would see "please try again". `}
                {errors > 0 && `${errors} didn't finish (see below).`}
              </p>
              {shown.length > 0 && (
                <p className="hint">
                  On average {Math.round(shown.reduce((t, r) => t + r.seconds, 0) / shown.length)} seconds and{" "}
                  {cents(shown.reduce((t, r) => t + (r.costUsd ?? 0), 0) / shown.length)} per plan, including the
                  checks.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {TEST_FAMILIES.map((test, family) => {
        const familyRuns = runs.filter((run) => run.family === family);
        if (!familyRuns.length) return null;
        return (
          <section className="card" key={test.title}>
            <h2 className="section-title">
              {test.title} ({test.family.maxMinutes} min max)
            </h2>
            {familyRuns.map((run) => (
              <SafeRunView key={run.round} run={run} showRound={rounds > 1} />
            ))}
          </section>
        );
      })}
    </>
  );
}

function SafeRunView({ run, showRound }: { run: SafeRun; showRound: boolean }) {
  const heading = showRound ? `Try ${run.round}` : null;
  if (run.error) {
    return (
      <div className="compare-run">
        {heading && <h3>{heading}</h3>}
        <p className="error">{run.error}</p>
      </div>
    );
  }
  if (!run.result) {
    return (
      <div className="compare-run">
        {heading && <h3>{heading}</h3>}
        <p className="quiet planning-message">Making and checking the plan…</p>
      </div>
    );
  }
  const result = run.result;
  return (
    <div className="compare-run">
      {heading && <h3>{heading}</h3>}
      <p className="hint">
        {Math.round(result.seconds)} seconds{result.costUsd !== undefined && ` · ${cents(result.costUsd)}`}
      </p>
      <ol className="safety-rounds">
        {result.rounds.map((round, i) => (
          <li key={i}>
            <strong>{round.checkedBy === "words" ? "Word check" : "AI double-check"}:</strong>{" "}
            {round.problems.length === 0 ? (
              <span className="compare-pass">found nothing</span>
            ) : (
              <>
                found {round.problems.length}, sent back to fix
                <ul>
                  {round.problems.map((problem, j) => (
                    <li key={j}>
                      “{problem.food}” in {problem.where}: {problem.who}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ol>
      {result.blocked ? (
        <p className="compare-fail">Blocked: this plan would never be shown. The family would see “please try again”.</p>
      ) : (
        <>
          <ul className="compare-dinners">
            {result.dinners!.map((dinner) => (
              <li key={dinner.day}>
                <strong>{dinner.day.slice(0, 3)}</strong> {dinner.name} · {dinner.minutes} min
              </li>
            ))}
          </ul>
          {finalIsClean(result) ? (
            <p className="compare-pass">Final check: followed every rule.</p>
          ) : (
            <ul className="compare-problems">
              {result.problems!.map((problem, i) => (
                <li key={i}>
                  <strong>{problem.who}:</strong> “{problem.food}” in {problem.where}: <em>{problem.text}</em>
                </li>
              ))}
              {result.tooLong!.length > 0 && (
                <li>
                  <strong>Too long:</strong> {result.tooLong!.join(", ")}
                </li>
              )}
              {result.missingDays!.length > 0 && (
                <li>
                  <strong>Missing:</strong> {result.missingDays!.join(", ")}
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
