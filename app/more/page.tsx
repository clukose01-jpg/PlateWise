"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountBadge from "@/components/AccountBadge";
import AccountCard from "@/components/AccountCard";
import FamilySummary from "@/components/FamilySummary";
import FeedbackCard from "@/components/FeedbackCard";
import { FoodList } from "@/components/FridgeStep";
import { Logo, QuestionIcon } from "@/components/Illustrations";
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
        <AccountBadge />
        <h1 className="plan-title">Your profile</h1>
      </header>

      {/* On a computer, these cards flow into columns. */}
      <div className="more-layout">
        {/* First, so a question never means scrolling to the bottom of the page. */}
        <Link href="/faq" className="card help-link">
          <QuestionIcon />
          <span className="help-text">
            <strong>Common questions</strong>
            <span className="hint">Quick answers about how PlateWise works</span>
          </span>
          <span className="chevron right" aria-hidden="true" />
        </Link>

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

        {/* Closed at first, since a full pantry pushes everything else far down. */}
        <details className="card fold">
          <summary>
            <span className="fold-title">
              <h2 className="section-title">Your pantry</h2>
              <span className="hint">
                {pantry.length === 0 ? "Nothing yet" : `${pantry.length} item${pantry.length === 1 ? "" : "s"}`}
              </span>
            </span>
            <span className="chevron" aria-hidden="true" />
          </summary>
          <p className="hint">Saved on this device and used in every plan. Remove anything you run out of.</p>
          <FoodList
            className="pantry"
            items={pantry}
            allItems={pantry}
            onChange={updatePantry}
            placeholder="Add pantry food"
            label="Add a pantry item"
          />
        </details>

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

        {/* Last, since they're needed least often. */}
        <AccountCard />

        <section className="card about">
          <h2 className="section-title">About PlateWise</h2>
          <p>
            PlateWise plans a week of family dinners in a few minutes. Tell it what&apos;s in your kitchen and
            who&apos;s eating, and it plans dinners everyone can eat, with one grocery list. It learns what your
            family likes each week.
          </p>
          <p className="hint">
            It&apos;s new and still being tested with families. Have a question? See the{" "}
            <Link href="/faq" className="link inline">
              common questions
            </Link>
            , or{" "}
            <a href="#feedback" className="link inline">
              tell us what you think
            </a>
            .
          </p>
        </section>
      </div>

      <TabBar active="more" />
    </main>
  );
}
