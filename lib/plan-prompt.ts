import { type Family, type Learned, QUICK_DINNER_MINUTES } from "./plan-schema";

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
    ...(family.learned?.busyNights.length
      ? [`- Busy weeknights, when she's often been rushed lately: ${family.learned.busyNights.join(", ")}`]
      : []),
    ...(family.budget ? [`- Grocery budget this week: $${family.budget}`] : []),
    `- Fresh food already in the fridge or freezer: ${family.fridgeItems.join(", ") || "nothing listed"}`,
    ...(family.useSoon?.length
      ? [`- Needs using up soon, before it goes bad: ${family.useSoon.join(", ")}`]
      : []),
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

// What they did with recent plans. Busy nights are part of describeFamily.
function describeActions(learned: Learned) {
  return [
    learned.made.length ? `- Dinners they made: ${learned.made.join("; ")}` : "",
    learned.passedOn.length
      ? `- Dinners they passed on, skipping them because they didn't sound good or swapping them for something else: ${learned.passedOn.join("; ")}`
      : "",
    learned.missingIngredient
      ? `- Dinners they skipped because an ingredient was missing: ${learned.missingIngredient}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// "area" is where to estimate prices for, like "NJ, US".
export function buildPlanPrompt(family: Family, area?: string) {
  const where = area ? `at a typical supermarket in ${area}` : "at a typical US supermarket";
  const learned = family.learned;
  const actions = learned ? describeActions(learned) : "";
  const busyNights = learned?.busyNights ?? [];
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
}${
  actions
    ? `
What they did with their recent plans:
${actions}
`
    : ""
}
Make this plan:

1. Dinners for Monday to Friday. Each one is a single meal the whole family eats.
   - Never use an allergen, including hidden sources such as oils, sauces and packaged foods that often contain it.
   - Never use a food any kid won't eat.
   - Each dinner takes no more than ${family.maxMinutes} minutes on the night, counting the Sunday prep as already done. "minutes" is that time.${
     busyNights.length
       ? `
   - On her busy nights (${busyNights.join(", ")}), keep dinner to ${Math.min(QUICK_DINNER_MINUTES, family.maxMinutes)} minutes or less on the night, leaning on Sunday prep, leftovers or simple assembly.`
       : ""
   }
   - Use the fresh food she already has first, using it early in the week, and build on what's in her pantry.${
     family.useSoon?.length ? " Use the food that needs using up soon on Monday or Tuesday." : ""
   }
   - Waste nothing. When a dinner uses part of something sold in a bigger package, like half a bag of spinach, a bunch of cilantro or a tub of sour cream, use the rest in another dinner or lunch that week. Reuse ingredients across meals so she buys fewer things.
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
   }${
     learned?.made.length || learned?.passedOn.length
       ? `
   - Learn from what they did with recent plans too: steer away from dinners they passed on, almost as firmly as ones they didn't like. Dinners they made fit their real weeknights, so similar dinners are good bets.`
       : ""
   }${
     learned?.missingIngredient
       ? `
   - They've skipped dinners because an ingredient was missing, so build more on what she already has and on everyday ingredients, and make sure the grocery list has everything else each dinner needs.`
       : ""
   }
   - In "why", write one short line, under 12 words, telling her why this dinner suits her family. Point to something specific from above: a dinner they liked or made, food she has or that needs using up, a busy night, her budget, a comment they made. Write it to her, like "A twist on the turkey tacos you all liked", "Uses your spinach before it goes bad" or "A quick one for a busy night". Don't mention allergies, foods a kid won't eat, or the day of the week, since she can move dinners to other days. Never make up a reason; if nothing specific applies, leave it empty.

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
   - "price" is about what that item costs ${where}, in US dollars, for what she'd actually buy, like a whole bag or jar.

5. In "sharedIngredients", list the food that more than one dinner or lunch uses, so none of it is left over, like a bag of spinach used on Monday and Thursday, with the days that use it. Only list real overlaps, and leave it empty if there are none. Leave out salt, pepper, oil and everyday pantry staples.${
     family.budget
       ? `

6. Her grocery budget this week is $${family.budget}. Keep the grocery list's total, the sum of its prices, at or under it.
   - Use what she already has first, pick budget-friendly ingredients, and use the same ingredients in more than one meal.
   - Never break an allergy, kid or cooking-time rule to save money.
   - If the week can't fit the budget, get as close to it as you can.`
       : ""
   }`;
}
