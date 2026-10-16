"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentPlanId } from "@/lib/device";
import { Logo, TabIcon } from "./Illustrations";

export type Tab = "today" | "week" | "groceries" | "new" | "more";

type Props = {
  active: Tab;
  // On a plan page, the tabs show that plan. Elsewhere, they show this device's latest plan.
  planId?: string;
};

// What Today, Week and Groceries say when they're tapped before there's a plan to show.
const NO_PLAN_YET: Partial<Record<Tab, string>> = {
  today: "Tonight's dinner shows up here once you make your first plan.",
  week: "Your week of dinners shows up here once you make your first plan.",
  groceries: "Your grocery list shows up here once you make your first plan.",
};

const NOTICE_MS = 4000;

export default function TabBar({ active, planId }: Props) {
  // undefined until this device has been checked, null when it has no plan yet.
  const [currentPlanId, setCurrentPlanIdState] = useState<string | null | undefined>(planId);
  const [notice, setNotice] = useState<{ text: string; shownAt: number } | null>(null);

  useEffect(() => {
    if (!planId) setCurrentPlanIdState(getCurrentPlanId());
  }, [planId]);

  // Each tap shows the note again, and it goes away by itself.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Before the check, "/" sends her to the right place either way.
  const planTab = (tab: string) => (currentPlanId ? `/plan/${currentPlanId}?tab=${tab}` : "/");

  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "today", label: "Today", href: planTab("today") },
    { id: "week", label: "Week", href: planTab("week") },
    { id: "groceries", label: "Groceries", href: planTab("groceries") },
    { id: "new", label: "New plan", href: "/new" },
    { id: "more", label: "Profile", href: "/more" },
  ];

  return (
    <>
      <nav className="tabbar" aria-label="PlateWise">
        {/* Only shown on a computer, where the tabs become a sidebar. */}
        <Link href="/" className="tabbar-logo">
          <Logo />
        </Link>
        {tabs.map((tab) => {
          const noPlanYet = currentPlanId === null ? NO_PLAN_YET[tab.id] : undefined;
          return noPlanYet ? (
            <button
              key={tab.id}
              type="button"
              className="tab"
              onClick={() => setNotice({ text: noPlanYet, shownAt: Date.now() })}
            >
              <TabIcon name={tab.id} />
              <span>{tab.label}</span>
            </button>
          ) : (
            <Link
              key={tab.id}
              href={tab.href}
              className={tab.id === active ? "tab active" : "tab"}
              aria-current={tab.id === active ? "page" : undefined}
            >
              <TabIcon name={tab.id} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="tab-notice-area" role="status">
        {notice && (
          <div key={notice.shownAt} className="tab-notice">
            <p>{notice.text}</p>
            {active !== "new" && <Link href="/new">Make a plan</Link>}
          </div>
        )}
      </div>
    </>
  );
}
