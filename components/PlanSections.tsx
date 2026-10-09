import type { Plan } from "@/lib/plan-schema";
import { WEEKDAYS } from "@/lib/plan-schema";
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

// One grocery list for the week, by store section. Ticks are shared with the Today tab.
export function GroceryList({ planId, groceryList }: { planId: string; groceryList: Plan["groceryList"] }) {
  return (
    <section className="card grocery">
      <h2 className="section-title">Grocery list</h2>
      <p className="hint">Tap items as they go in your cart.</p>
      {groceryList.map((group) => (
        <div className="grocery-section" key={group.section}>
          <h3>{group.section}</h3>
          <Checklist items={group.items} storageKey={`platewise.${planId}.grocery.${group.section}`} />
        </div>
      ))}
    </section>
  );
}
