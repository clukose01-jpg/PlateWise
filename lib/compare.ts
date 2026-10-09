// A temporary side-by-side test: the same families planned with Claude thinking for "medium" (today)
// and "low" (faster and cheaper), checked for foods each family can't eat. Remove once decided.
import type { Family, Plan } from "./plan-schema";

// A food to look for. `except` lists words that make it safe right before it, like "coconut milk".
type Food = string | { word: string; except: string[] };
type Rule = { who: string; foods: Food[] };
export type TestFamily = { title: string; family: Family; rules: Rule[] };

const common = { feedback: [], madeOn: "Sunday, October 11" };

const PLANT_BASED = ["dairy-free", "vegan", "plant-based", "non-dairy"];
const GLUTEN_FREE = ["gluten-free", "gf"];

// Each family has traps: foods they can't eat sitting in their own fridge or pantry.
export const TEST_FAMILIES: TestFamily[] = [
  {
    title: "Peanut and tree nut allergy, two picky kids",
    family: {
      ...common,
      allergies: "Peanuts and tree nuts",
      adults: 2,
      kids: [
        { name: "Maya", refuses: "mushrooms, fish" },
        { name: "Leo", refuses: "anything spicy, onions" },
      ],
      maxMinutes: 30,
      lunches: true,
      fridgeItems: ["chicken thighs", "baby spinach", "eggs", "cheddar cheese", "bell peppers", "yellow onions"],
      pantryItems: ["rice", "pasta", "peanut butter", "almonds", "canned tomatoes", "soy sauce"],
    },
    rules: [
      {
        who: "Peanut and tree nut allergy",
        foods: ["peanut", "peanuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan",
          "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "nut", "nuts", "satay", "pesto", "praline"],
      },
      {
        who: "Maya won't eat mushrooms or fish",
        foods: ["mushroom", "mushrooms", "fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout",
          "anchovy", "anchovies"],
      },
      {
        who: "Leo won't eat spicy food or onions",
        foods: ["spicy", "jalapeño", "jalapeno", "jalapeños", "jalapenos", "chili", "chile", "chilli", "cayenne",
          "sriracha", "hot sauce", "red pepper flakes", "chipotle", "onion", "onions", "scallion", "scallions",
          "shallot", "shallots"],
      },
    ],
  },
  {
    title: "Dairy and shellfish allergy, one picky kid",
    family: {
      ...common,
      allergies: "Dairy (milk, cheese, butter) and shellfish",
      adults: 1,
      kids: [{ name: "Sam", refuses: "tomatoes, beans" }],
      maxMinutes: 20,
      lunches: false,
      fridgeItems: ["shrimp", "milk", "butter", "ground turkey", "broccoli", "cheddar cheese"],
      pantryItems: ["rice", "tortillas", "olive oil", "canned black beans", "salsa", "soy sauce"],
    },
    rules: [
      {
        who: "Dairy allergy",
        foods: [
          { word: "milk", except: ["coconut", "oat", "soy", "almond", "rice", ...PLANT_BASED] },
          { word: "cheese", except: PLANT_BASED },
          { word: "butter", except: ["peanut", "almond", "sunflower", "seed", "apple", ...PLANT_BASED] },
          { word: "cream", except: ["coconut", ...PLANT_BASED] },
          { word: "yogurt", except: ["coconut", "oat", "soy", ...PLANT_BASED] },
          "parmesan", "mozzarella", "cheddar", "ricotta", "feta", "ghee", "buttermilk", "whey", "queso",
        ],
      },
      {
        who: "Shellfish allergy",
        foods: ["shrimp", "prawn", "prawns", "crab", "lobster", "scallop", "scallops", "clam", "clams", "mussel",
          "mussels", "oyster", "oysters", "shellfish"],
      },
      {
        who: "Sam won't eat tomatoes or beans",
        foods: ["tomato", "tomatoes", "marinara", "salsa", "ketchup", "bean", "beans"],
      },
    ],
  },
  {
    title: "Egg and wheat allergy, two picky kids",
    family: {
      ...common,
      allergies: "Eggs and wheat (gluten)",
      adults: 2,
      kids: [
        { name: "Ava", refuses: "broccoli, spinach, peppers" },
        { name: "Noah", refuses: "pork" },
      ],
      maxMinutes: 45,
      lunches: true,
      fridgeItems: ["eggs", "salmon", "potatoes", "broccoli", "pork chops", "yogurt", "bacon"],
      pantryItems: ["pasta", "flour", "bread crumbs", "rice", "corn tortillas", "soy sauce"],
    },
    rules: [
      {
        who: "Egg allergy",
        foods: ["egg", "eggs", { word: "mayo", except: ["vegan", "egg-free"] },
          { word: "mayonnaise", except: ["vegan", "egg-free"] }, "meringue"],
      },
      {
        who: "Wheat allergy",
        foods: [
          "wheat", "couscous", "panko", "breadcrumbs", "croutons", "pita", "naan", "cracker", "crackers",
          { word: "flour", except: ["rice", "corn", "almond", "coconut", "cassava", "chickpea", ...GLUTEN_FREE] },
          { word: "bread", except: GLUTEN_FREE },
          { word: "bread crumbs", except: GLUTEN_FREE },
          { word: "pasta", except: ["rice", "chickpea", "lentil", "corn", ...GLUTEN_FREE] },
          { word: "spaghetti", except: GLUTEN_FREE },
          { word: "noodles", except: ["rice", "glass", ...GLUTEN_FREE] },
          { word: "soy sauce", except: GLUTEN_FREE },
          { word: "gluten", except: [] },
        ],
      },
      {
        who: "Ava won't eat broccoli, spinach or peppers",
        foods: ["broccoli", "spinach", "bell pepper", "bell peppers", "peppers"],
      },
      {
        who: "Noah won't eat pork",
        foods: ["pork", "bacon", "ham", "prosciutto", "pepperoni",
          { word: "sausage", except: ["chicken", "turkey"] }, { word: "sausages", except: ["chicken", "turkey"] }],
      },
    ],
  },
];

export type Problem = { who: string; food: string; where: string; text: string };

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Every piece of text in the plan, with where it appears.
function planText(plan: Plan): { where: string; text: string }[] {
  return [
    ...plan.dinners.flatMap((d) => [
      { where: `${d.day} dinner`, text: d.name },
      { where: `${d.day} tip`, text: d.tip },
      ...d.steps.map((text) => ({ where: `${d.day} steps`, text })),
      ...d.nightBefore.map((text) => ({ where: `${d.day} night before`, text })),
    ]),
    ...plan.lunches.map((l) => ({ where: `${l.day} lunch`, text: l.name })),
    ...plan.prepList.flatMap((p) => p.steps.map((text) => ({ where: `Sunday prep for ${p.day}`, text }))),
    ...plan.groceryList.flatMap((g) => g.items.map((text) => ({ where: `Grocery list (${g.section})`, text }))),
  ];
}

// Words just before a match that mean the food is being avoided, like "no onions" or "nut-free".
const AVOIDING = /(-free|\bfree|\bno|\bwithout|\binstead of|\bskip|\bnot|\bavoid|\bleave out)\s*[\w-]*\s*$/i;

export function checkPlan(test: TestFamily, plan: Plan) {
  const problems: Problem[] = [];
  for (const { where, text } of planText(plan)) {
    for (const rule of test.rules) {
      for (const food of rule.foods) {
        const { word, except } = typeof food === "string" ? { word: food, except: [] } : food;
        const pattern = new RegExp(`\\b${escape(word)}\\b`, "gi");
        for (const match of text.matchAll(pattern)) {
          const before = text.slice(Math.max(0, match.index - 30), match.index).toLowerCase();
          const after = text.slice(match.index + match[0].length).toLowerCase();
          // "peanut-free", "no onions", "without nuts"
          if (/^[\s-]?free\b/.test(after) || AVOIDING.test(before)) continue;
          if (except.some((safe) => before.trimEnd().endsWith(safe))) continue;
          if (!problems.some((p) => p.where === where && p.text === text && p.who === rule.who)) {
            problems.push({ who: rule.who, food: match[0], where, text });
          }
        }
      }
    }
  }
  const tooLong = plan.dinners.filter((d) => d.minutes > test.family.maxMinutes).map((d) => `${d.day} (${d.minutes} min)`);
  const days = plan.dinners.map((d) => d.day);
  const missingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].filter((day) => !days.includes(day as never));
  return { problems, tooLong, missingDays };
}
