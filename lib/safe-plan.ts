// Every plan is checked for foods the family can't eat before anyone sees it:
// 1. A word check: allergens, foods that usually contain them, and foods the kids won't eat, plus
//    dinners over her cooking time and missing days.
// 2. If that passes, a second, careful look by Claude for hidden allergens.
// Anything found goes back to Claude to fix, and the fixed plan is checked again from the start.
// If it still isn't clean after two fixes, the plan is never shown.
import { familyRules, findProblems, hasFoodRules, type Problem } from "./food-check";
import { type Family, type Plan, type TestInfo, WEEKDAYS } from "./plan-schema";
import { reviewPlan } from "./safety-review";

// On since the test page ran five trap families through it with the real AI: every final plan
// followed every rule, and 3 of the 5 were fixed by the check first.
export const SAFETY_CHECK_ON = true;

const MAX_FIXES = 2;

export type PlanFix = { problems: Problem[]; plan: Plan };
export type SafetyRound = { checkedBy: "words" | "review"; problems: Problem[] };
type Generated = { plan: Plan; test: TestInfo } | null;

export class PlanSafetyError extends Error {
  constructor(readonly rounds: SafetyRound[]) {
    super("The plan still had problem foods after fixing.");
  }
}

// What Claude is told when its plan needs fixing.
export function describeFix(fix: PlanFix) {
  const lines = fix.problems.map(
    (p) => `- ${p.where}: "${p.food}". ${p.who}${p.text ? ` (it says: "${p.text}")` : ""}`,
  );
  return `

A safety check found foods this family can't eat in the plan you made:
${lines.join("\n")}

Here is that plan:
${JSON.stringify(fix.plan)}

Make the plan again with every one of these fixed, keeping everything else that was fine. When you use a safe substitute, name it clearly everywhere it appears, including the grocery list, like "gluten-free pasta", "dairy-free cheese" or "sunflower seed butter", so the right one gets bought.`;
}

// Dinners over her cooking time, and weekdays with no dinner.
function planRuleProblems(family: Family, plan: Plan): Problem[] {
  const tooLong = plan.dinners
    .filter((d) => d.minutes > family.maxMinutes)
    .map((d) => ({
      who: `Takes ${d.minutes} minutes; the most she has on a weeknight is ${family.maxMinutes}`,
      food: d.name,
      where: `${d.day} dinner`,
      text: "",
    }));
  const missing = WEEKDAYS.filter((day) => !plan.dinners.some((d) => d.day === day)).map((day) => ({
    who: "Every weeknight needs a dinner",
    food: "no dinner",
    where: `${day} dinner`,
    text: "",
  }));
  return [...tooLong, ...missing];
}

function addTests(a: TestInfo, b: TestInfo): TestInfo {
  return {
    model: a.model,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd === null || b.costUsd === null ? null : a.costUsd + b.costUsd,
    seconds: a.seconds + b.seconds,
  };
}

// `generate` makes the plan, or remakes it with the problems to fix. `checkPart` picks what's new
// and needs checking, like only the swapped dinner and the updated lists.
export async function makeSafePlan(
  family: Family,
  generate: (fix?: PlanFix) => Promise<Generated>,
  checkPart: (plan: Plan) => Plan = (plan) => plan,
): Promise<{ plan: Plan; test: TestInfo; rounds: SafetyRound[] } | null> {
  const first = await generate();
  if (!first) return null;
  let { plan, test } = first;
  const rounds: SafetyRound[] = [];
  const rules = familyRules(family);

  for (let fixes = 0; ; fixes++) {
    const part = checkPart(plan);
    let round: SafetyRound = {
      checkedBy: "words",
      problems: [...findProblems(part, rules), ...planRuleProblems(family, part)],
    };
    if (!round.problems.length && hasFoodRules(family)) {
      const review = await reviewPlan(family, part);
      test = addTests(test, review.test);
      round = { checkedBy: "review", problems: review.problems };
    }
    rounds.push(round);
    if (!round.problems.length) return { plan, test, rounds };
    if (fixes === MAX_FIXES) throw new PlanSafetyError(rounds);

    const fixed = await generate({ problems: round.problems, plan });
    if (!fixed) throw new PlanSafetyError(rounds);
    plan = fixed.plan;
    test = addTests(test, fixed.test);
  }
}
