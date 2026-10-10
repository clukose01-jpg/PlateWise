import type { Family } from "./plan-schema";

// The instructions Claude follows to plan a family's week. Used to make a plan and to swap a dinner.

function describeFamily(family: Family) {
  const kids = family.kids.length;
  const eaters = `${family.adults} adult${family.adults === 1 ? "" : "s"}${
    kids ? ` and ${kids} kid${kids === 1 ? "" : "s"}` : ""
  }`;
  const kidLines = family.kids.map((kid, i) => {
    const name = kid.name.trim() || `Kid ${i + 1}`;
    const refuses = kid.refuses.trim();
    return `  - ${name}: ${refuses ? `won't eat ${refuses}` : "no foods listed"}`;
  });

  return [
    `- Eating: ${eaters}`,
    ...(kidLines.length ? ["- Kids:", ...kidLines] : []),
    `- Allergies: ${family.allergies.trim() || "none"}`,
    `- Longest she'll cook on a weeknight: ${family.maxMinutes} minutes`,
    ...(family.budget ? [`- Grocery budget this week: $${family.budget}`] : []),
    `- Fresh food already in the fridge or freezer: ${family.fridgeItems.join(", ") || "nothing listed"}`,
    `- Already in the pantry: ${family.pantryItems.join(", ") || "nothing listed"}`,
  ].join("\n");
}

function describeFeedback(family: Family) {
  return family.feedback
    .map((rating) => {
      const verdict = rating.liked ? "Liked" : "Didn't like";
      const note = rating.note ? ` Their comment: "${rating.note}"` : "";
      const recent = rating.lastPlan ? " (from last week's plan)" : "";
      return `- ${verdict}: ${rating.dish}${recent}.${note}`;
    })
    .join("\n");
}

// "area" is where to estimate prices for, like "NJ, US".
export function buildPlanPrompt(family: Family, area?: string) {
  const where = area ? `at a typical supermarket in ${area}` : "at a typical US supermarket";
  return `You're planning a week of dinners for a busy working parent. She shops once and preps on Sunday, so on weeknights there's nothing left to decide.

About the family:
${describeFamily(family)}
${
  family.feedback.length
    ? `
What the family thought of past dinners, newest first:
${describeFeedback(family)}
`
    : ""
}
Make this plan:

1. Dinners for Monday to Friday. Each one is a single meal the whole family eats.
   - Never use an allergen, including hidden sources such as oils, sauces and packaged foods that often contain it.
   - Never use a food any kid won't eat.
   - Each dinner takes no more than ${family.maxMinutes} minutes on the night, counting the Sunday prep as already done. "minutes" is that time.
   - Use the fresh food she already has first, using it early in the week, and build on what's in her pantry.
   - Keep it varied: don't serve the same main ingredient on back-to-back nights.
   - Stick to meals kids usually like, made from ingredients any ordinary supermarket sells.
   - In "ingredients", list everything the dinner uses with amounts for this household, like "1 lb chicken thighs" or "2 cups rice", including food she already has. Say when Sunday's prep already readied it, like "2 cups rice (cooked Sunday)". Leave out salt, pepper and cooking oil.
   - Give 3 to 6 short steps in plain words, and say when a step uses Sunday's prep.
   - "cost" is about what the dinner's ingredients cost ${where}, in US dollars, counting only the amounts it uses, including food she already has.
   - Add a tip when it helps a picky eater, like serving the sauce on the side. Otherwise leave the tip empty.
   - In nightBefore, list anything to do the night before, like moving meat from the freezer to the fridge or soaking beans. Leave it empty if there's nothing.${
     family.feedback.length
       ? `
   - Learn from what they thought of past dinners: bring back dinners they liked or close variations of them, steer away from what they didn't like, and follow their comments.
   - The more dinners they've liked, the more of the week should be favorites and variations on them. Keep one or two new ideas each week so it doesn't get boring.
   - Don't serve the exact same dinner as last week's plan.`
       : ""
   }

2. ${
    family.lunches
      ? "Lunches for Monday to Friday that are simple and easy to pack. Leftovers from the night before are fine."
      : "No lunches. Leave the lunches list empty."
  }

3. A Sunday prep list: what to wash, chop, marinate or cook on Sunday so weeknights go fast.
   - Group it by the day the prep is for, and leave out days that need no prep.
   - Write each step as one short action of a few words, like "Chop 1 onion" or "Marinate the chicken". Put each action in its own step instead of joining several in one sentence.
   - Only prep ahead what stays safe and fresh until the day it's eaten. For later in the week, add a step to freeze it, or leave it for that day.

4. One grocery list for a single trip: everything the plan needs that isn't already in her fridge, freezer or pantry, with amounts for this household. Group it by store section: Produce, Meat and fish, Dairy and eggs, Bakery, Pantry, Frozen. Leave out empty sections. Assume she already has salt, pepper and cooking oil.
   - Give each item's name with its amount, like "2 lb chicken thighs".
   - "price" is about what that item costs ${where}, in US dollars, for what she'd actually buy, like a whole bag or jar.${
     family.budget
       ? `

5. Her grocery budget this week is $${family.budget}. Keep the grocery list's total, the sum of its prices, at or under it.
   - Use what she already has first, pick budget-friendly ingredients, and use the same ingredients in more than one meal.
   - Never break an allergy, kid or cooking-time rule to save money.
   - If the week can't fit the budget, get as close to it as you can.`
       : ""
   }`;
}
