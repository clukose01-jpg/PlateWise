// Finds foods a family can't eat anywhere in a plan: allergens, including foods that usually
// contain them (wheat in soy sauce and bread), and foods the kids won't eat. A food written as a
// safe version, like "gluten-free pasta" or "dairy-free cheese", or one being avoided, like
// "no onions", doesn't count.
import { type Family, itemName, type Plan } from "./plan-schema";

// A food word to look for. `except` lists words that make it safe right before it, like "coconut milk".
export type Food = string | { word: string; except: string[] };
export type Problem = { who: string; food: string; where: string; text: string };

const PLANT_BASED = ["dairy-free", "dairy free", "vegan", "plant-based", "non-dairy"];
const GLUTEN_FREE = ["gluten-free", "gluten free", "wheat-free", "gf"];
const EGG_FREE = ["egg-free", "egg free", "vegan"];

const gf = (word: string, ...more: string[]) => ({ word, except: [...more, ...GLUTEN_FREE] });

type FoodGroup = {
  // Words in her allergy answer that mean this group, like "dairy" or "gluten".
  names: string[];
  // Words that only mean this group when they're the whole answer, like "nuts".
  exact?: string[];
  foods: Food[];
};

const PEANUTS: FoodGroup = {
  names: ["peanut", "peanuts", "groundnut", "groundnuts"],
  exact: ["nut", "nuts"],
  foods: ["peanut", "peanuts", "satay", "groundnut", "groundnuts"],
};

const TREE_NUTS: FoodGroup = {
  names: ["tree nut", "tree nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan",
    "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia"],
  exact: ["nut", "nuts"],
  foods: ["nut", "nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans",
    "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "pine nut", "pine nuts", "pesto",
    "praline", "marzipan", "nutella", "frangipane"],
};

const DAIRY: FoodGroup = {
  names: ["milk", "dairy", "lactose", "cheese", "casein", "whey"],
  // "peanut butter" as an allergy answer isn't dairy.
  exact: ["butter"],
  foods: [
    { word: "milk", except: ["coconut", "oat", "soy", "almond", "rice", "cashew", "hemp", "pea", ...PLANT_BASED] },
    { word: "cheese", except: PLANT_BASED },
    { word: "cheeses", except: PLANT_BASED },
    { word: "butter", except: ["peanut", "almond", "cashew", "sunflower", "seed", "apple", "nut", ...PLANT_BASED] },
    { word: "cream", except: ["coconut", ...PLANT_BASED] },
    { word: "yogurt", except: ["coconut", "oat", "soy", "almond", ...PLANT_BASED] },
    { word: "yoghurt", except: ["coconut", "oat", "soy", "almond", ...PLANT_BASED] },
    "parmesan", "mozzarella", "cheddar", "ricotta", "feta", "ghee", "buttermilk", "whey", "casein", "queso",
    "custard", "alfredo", "bechamel", "béchamel", "ranch",
  ],
};

const EGGS: FoodGroup = {
  names: ["egg", "eggs"],
  foods: ["egg", "eggs", { word: "mayo", except: EGG_FREE }, { word: "mayonnaise", except: EGG_FREE },
    { word: "aioli", except: EGG_FREE }, "meringue", "custard", "frittata", "omelet", "omelette", "quiche",
    "hollandaise", "caesar"],
};

const WHEAT: FoodGroup = {
  names: ["wheat", "gluten", "celiac", "coeliac"],
  foods: [
    "wheat", "barley", "rye", "semolina", "bulgur", "farro", "couscous", "seitan", "panko", "croutons", "pita",
    "naan", "malt", "ramen", "udon",
    gf("flour", "rice", "corn", "almond", "coconut", "cassava", "chickpea", "tapioca", "potato"),
    gf("bread"), gf("breads"), gf("breadcrumbs"), gf("bread crumbs"), gf("toast"), gf("sandwich"),
    gf("sandwiches"), gf("bun"), gf("buns"), gf("bagel"), gf("bagels"), gf("muffin"), gf("muffins"),
    gf("biscuit"), gf("biscuits"), gf("pancake"), gf("pancakes"), gf("waffle"), gf("waffles"),
    gf("crackers", "rice"), gf("pizza dough"), gf("pizza crust"), gf("pie crust"),
    gf("pasta", "rice", "chickpea", "lentil", "corn", "bean"), gf("spaghetti"), gf("macaroni"),
    gf("penne"), gf("orzo"), gf("gnocchi"), gf("lasagna"), gf("noodle", "rice", "glass"),
    gf("noodles", "rice", "glass"), gf("tortilla", "corn"), gf("tortillas", "corn"),
    gf("wrap", "lettuce", "corn"), gf("wraps", "lettuce", "corn"), gf("soy sauce"), gf("teriyaki"),
  ],
};

const FISH: FoodGroup = {
  names: ["fish", "seafood"],
  foods: ["fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout", "anchovy", "anchovies", "sardine",
    "sardines", "mackerel", "haddock", "pollock", "catfish", "snapper", "mahi", "swordfish", "worcestershire",
    "caesar"],
};

const SHELLFISH: FoodGroup = {
  names: ["shellfish", "crustacean", "crustaceans", "shrimp", "seafood", "crab", "lobster"],
  foods: ["shrimp", "prawn", "prawns", "crab", "lobster", "crawfish", "crayfish", "scallop", "scallops", "clam",
    "clams", "mussel", "mussels", "oyster", "oysters", "shellfish", "squid", "calamari", "octopus"],
};

const SOY: FoodGroup = {
  names: ["soy", "soya", "soybean", "soybeans"],
  foods: ["soy", "soya", "tofu", "edamame", "tamari", "miso", "tempeh", "teriyaki", "soybean", "soybeans"],
};

const SESAME: FoodGroup = {
  names: ["sesame"],
  foods: ["sesame", "tahini", "hummus", "halva", "furikake"],
};

const ALLERGY_GROUPS = [PEANUTS, TREE_NUTS, DAIRY, EGGS, WHEAT, FISH, SHELLFISH, SOY, SESAME];

// Kids' dislikes that mean a whole group: a kid who won't eat fish won't eat salmon either.
const SPICY: FoodGroup = {
  names: ["spicy", "spice"],
  foods: ["spicy", "jalapeño", "jalapeno", "jalapeños", "jalapenos", "chili", "chile", "chilli", "chilies",
    "chiles", "cayenne", "sriracha", "hot sauce", "red pepper flakes", "chipotle", "buffalo"],
};
const MUSHROOMS: FoodGroup = { names: ["mushroom", "mushrooms"], foods: ["mushroom", "mushrooms"] };
const KID_GROUPS = [FISH, SHELLFISH, EGGS, PEANUTS, TREE_NUTS, SPICY, MUSHROOMS];

// Words like "salt and pepper" aren't the vegetable.
const SAFE_BEFORE: Record<string, string[]> = {
  pepper: ["black", "white", "salt and", "cracked", "ground"],
  peppers: ["black", "white"],
};

// Splits an answer like "Dairy (milk, cheese) and shellfish" into its parts.
function terms(answer: string) {
  return answer
    .toLowerCase()
    .replace(/\b(allergic to|allergy|allergies|severe|mild|intolerance|anything|any|too)\b/g, " ")
    .split(/[,;/()&+]|\band\b|\bor\b|\bno\b/)
    .map((term) => term.replace(/\s+/g, " ").trim())
    .filter((term) => term.length >= 3 && !["none", "n/a", "nothing"].includes(term));
}

function mentions(term: string, word: string) {
  return new RegExp(`\\b${escape(word)}\\b`).test(term);
}

// "tomatoes" also finds "tomato", and "onion" also finds "onions".
function withPlurals(term: string): Food[] {
  const forms = new Set([term]);
  if (term.endsWith("oes")) forms.add(term.slice(0, -2));
  else if (term.endsWith("ies")) forms.add(`${term.slice(0, -3)}y`);
  else if (term.endsWith("s")) forms.add(term.slice(0, -1));
  else forms.add(`${term}s`);
  return [...forms].map((word) => (SAFE_BEFORE[word] ? { word, except: SAFE_BEFORE[word] } : word));
}

function foodsFor(answer: string, groups: FoodGroup[]) {
  const foods: Food[] = [];
  for (const term of terms(answer)) {
    const matched = groups.filter(
      (group) => group.names.some((name) => mentions(term, name)) || group.exact?.includes(term),
    );
    if (matched.length) matched.forEach((group) => foods.push(...group.foods));
    else foods.push(...withPlurals(term));
  }
  return foods;
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Words right before a match that mean the food is being left out, like "no onions", "without nuts" or
// "instead of butter". Only directly before, so "no-bake peanut bars" and "no sugar peanut butter"
// still count. When unsure, it counts the food: a false alarm only costs a quick fix.
const AVOIDING = /\b(no|without|instead of|in place of|skip|not|avoid|leave out|hold the)\s+$/i;

// "goat milk" doesn't end with the safe word "oat".
function endsWithWord(text: string, word: string) {
  return new RegExp(`\\b${escape(word)}$`).test(text);
}

// Where a food shows up in some text, or null if it doesn't (or only as a safe version).
export function findFood(text: string, food: Food): string | null {
  const { word, except } = typeof food === "string" ? { word: food, except: [] } : food;
  for (const match of text.matchAll(new RegExp(`\\b${escape(word)}\\b`, "gi"))) {
    const before = text.slice(Math.max(0, match.index - 30), match.index).toLowerCase();
    const after = text.slice(match.index + match[0].length).toLowerCase();
    // "peanut-free", "no onions", "without nuts"
    if (/^[\s-]?free\b/.test(after) || AVOIDING.test(before)) continue;
    if (except.some((safe) => endsWithWord(before.trimEnd(), safe))) continue;
    return match[0];
  }
  return null;
}

// Every piece of text in the plan, with where it appears.
export function planText(plan: Plan): { where: string; text: string }[] {
  return [
    ...plan.dinners.flatMap((d) => [
      { where: `${d.day} dinner`, text: d.name },
      { where: `${d.day} tip`, text: d.tip },
      ...d.steps.map((text) => ({ where: `${d.day} steps`, text })),
      ...(d.nightBefore ?? []).map((text) => ({ where: `${d.day} night before`, text })),
    ]),
    ...plan.lunches.map((l) => ({ where: `${l.day} lunch`, text: l.name })),
    ...plan.prepList.flatMap((p) => p.steps.map((text) => ({ where: `Sunday prep for ${p.day}`, text }))),
    ...plan.groceryList.flatMap((g) =>
      g.items.map((item) => ({ where: `Grocery list (${g.section})`, text: itemName(item) })),
    ),
  ];
}

export function findProblems(plan: Plan, rules: { who: string; foods: Food[] }[]): Problem[] {
  const problems: Problem[] = [];
  for (const { where, text } of planText(plan)) {
    for (const rule of rules) {
      for (const food of rule.foods) {
        const found = findFood(text, food);
        if (found && !problems.some((p) => p.where === where && p.text === text && p.who === rule.who)) {
          problems.push({ who: rule.who, food: found, where, text });
        }
      }
    }
  }
  return problems;
}

// The rules for one family, from their allergy answer and what each kid won't eat.
export function familyRules(family: Family) {
  const rules: { who: string; foods: Food[] }[] = [];
  const allergies = family.allergies.trim();
  if (allergies) {
    const foods = foodsFor(allergies, ALLERGY_GROUPS);
    if (foods.length) rules.push({ who: `Allergy: ${allergies}`, foods });
  }
  family.kids.forEach((kid, i) => {
    const foods = foodsFor(kid.refuses, KID_GROUPS);
    if (foods.length) rules.push({ who: `${kid.name.trim() || `Kid ${i + 1}`} won't eat ${kid.refuses.trim()}`, foods });
  });
  return rules;
}

export function hasFoodRules(family: Family) {
  return Boolean(family.allergies.trim() || family.kids.some((kid) => kid.refuses.trim()));
}
