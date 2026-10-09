"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentPlanId } from "@/lib/device";
import { TabIcon } from "./Illustrations";

export type Tab = "today" | "week" | "groceries" | "new" | "more";

type Props = {
  active: Tab;
  // On a plan page, the tabs show that plan. Elsewhere, they show this phone's latest plan.
  planId?: string;
};

export default function TabBar({ active, planId }: Props) {
  const [currentPlanId, setCurrentPlanIdState] = useState<string | null>(planId ?? null);

  useEffect(() => {
    if (!planId) setCurrentPlanIdState(getCurrentPlanId());
  }, [planId]);

  const planTab = (tab: string) => (currentPlanId ? `/plan/${currentPlanId}?tab=${tab}` : "/new");

  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "today", label: "Today", href: planTab("today") },
    { id: "week", label: "Week", href: planTab("week") },
    { id: "groceries", label: "Groceries", href: planTab("groceries") },
    { id: "new", label: "New plan", href: "/new" },
    { id: "more", label: "More", href: "/more" },
  ];

  return (
    <nav className="tabbar" aria-label="PlateWise">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={tab.id === active ? "tab active" : "tab"}
          aria-current={tab.id === active ? "page" : undefined}
        >
          <TabIcon name={tab.id} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
