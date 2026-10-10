"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountCard from "@/components/AccountCard";
import FamilySummary from "@/components/FamilySummary";
import FeedbackCard from "@/components/FeedbackCard";
import { FoodList } from "@/components/FridgeStep";
import { Logo } from "@/components/Illustrations";
import InstallHelp from "@/components/InstallHelp";
import PlanHistory from "@/components/PlanHistory";
import ReminderSettings from "@/components/ReminderSettings";
import TabBar from "@/components/TabBar";
import { syncFromAccount } from "@/lib/account-client";
import { loadFamily, loadPantry, type SavedFamily, savePantry } from "@/lib/device";
import { type DinnerRating, likedDinners } from "@/lib/ratings";

export default function MorePage() {
  const [favorites, setFavorites] = useState<DinnerRating[]>([]);
  const [pantry, setPantry] = useState<string[]>([]);
  const [family, setFamily] = useState<SavedFamily | null>(null);

  useEffect(() => {
    syncFromAccount().then(() => {
      setFavorites(likedDinners());
      setPantry(loadPantry());
      setFamily(loadFamily());
    });
  }, []);

  function updatePantry(items: string[]) {
    setPantry(items);
    savePantry(items);
  }

  return (
    <main>
      <header>
        <Logo />
        <h1 className="plan-title">More</h1>
      </header>

      {/* On a computer, these cards flow into columns. */}
      <div className="more-layout">
        <AccountCard />

        <section className="card">
          <h2 className="section-title">Favorite dinners</h2>
          {favorites.length === 0 ? (
            <p className="quiet">
              Rate dinners on your plan, and the ones your family liked will show up here. Your next
              plans bring favorites back.
            </p>
          ) : (
            <ul className="favorites">
              {favorites.map((favorite) => (
                <li key={`${favorite.planId}:${favorite.day}`}>
                  <span className="dish">{favorite.dish}</span>
                  {favorite.note && <span className="hint">“{favorite.note}”</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <PlanHistory />

        <section className="card">
          <h2 className="section-title">Your pantry</h2>
          <p className="hint">Saved on this device and used in every plan. Remove anything you run out of.</p>
          <FoodList
            className="pantry"
            items={pantry}
            allItems={pantry}
            onChange={updatePantry}
            placeholder="Add pantry food"
            label="Add a pantry item"
          />
        </section>

        <section className="card">
          <h2 className="section-title">Your family</h2>
          {family ? (
            <FamilySummary family={family} />
          ) : (
            <p className="quiet">You&apos;ll answer a few questions when you make your first plan.</p>
          )}
          <Link href="/new" className="secondary">
            {family ? "Change these in a new plan" : "Make a plan"}
          </Link>
        </section>

        <ReminderSettings />

        <FeedbackCard />

        <InstallHelp />
      </div>

      <TabBar active="more" />
    </main>
  );
}
