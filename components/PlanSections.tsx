import { dollars, groceryTotal, itemName, itemPrice, WEEKDAYS } from "@/lib/plan-schema";
import type { StoredPlan } from "@/lib/plans";
import Checklist from "./Checklist";

export type PrepGroup = { day: string; steps: string[] };

// The Sunday prep list, grouped by the day each step is for.
export function PrepList({ planId, groups }: { planId: string; groups: PrepGroup[] }) {
  return (
    <section className="card prep">
      <h2 className="section-title">Sunday prep</h2>
      {groups.map((group) => (
        <div className="prep-day" key={group.day || "all"}>
          {group.day && (
            <h3>
              <span
                className={`day-badge small day-${WEEKDAYS.indexOf(group.day as (typeof WEEKDAYS)[number])}`}
              >
                {group.day.slice(0, 3)}
              </span>
              For {group.day}
            </h3>
          )}
          <Checklist
            items={group.steps}
            storageKey={group.day ? `platewise.${planId}.prep.${group.day}` : `platewise.${planId}.prep`}
          />
        </div>
      ))}
    </section>
  );
}

// How the week's groceries compare with her budget, if she set one.
function BudgetFit({ total, budget }: { total: number; budget: number }) {
  const over = Math.round(total - budget);
  return over > 0 ? (
    <p className="budget over">
      {dollars(over)} over your {dollars(budget)} budget
    </p>
  ) : (
    <p className="budget under">Within your {dollars(budget)} budget</p>
  );
}

// One grocery list for the week, by store section, with estimated prices. Ticks are shared with the
// Today tab. Plans made before prices were added just don't show them.
export function GroceryList({
  planId,
  groceryList,
  budget,
}: {
  planId: string;
  groceryList: StoredPlan["plan"]["groceryList"];
  budget?: number | null;
}) {
  const total = groceryTotal(groceryList);
  return (
    <section className="card grocery">
      <h2 className="section-title">Grocery list</h2>
      {total !== null && (
        <div className="grocery-total">
          <p className="grocery-sum">About {dollars(total)}</p>
          {budget ? <BudgetFit total={total} budget={budget} /> : null}
        </div>
      )}
      <p className="hint">
        Tap items as they go in your cart.
        {total !== null && " Prices are estimates, so your store's may differ."}
      </p>
      {groceryList.map((group) => (
        <div className="grocery-section" key={group.section}>
          <h3>{group.section}</h3>
          <Checklist
            items={group.items.map(itemName)}
            asides={group.items.map((item) => {
              const price = itemPrice(item);
              // Items show cents, like a shelf tag, so they add up to the total.
              return price === null ? null : `$${price.toFixed(2)}`;
            })}
            storageKey={`platewise.${planId}.grocery.${group.section}`}
          />
        </div>
      ))}
    </section>
  );
}
