"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FoodList } from "@/components/FridgeStep";
import { Logo } from "@/components/Illustrations";
import InstallHelp from "@/components/InstallHelp";
import TabBar from "@/components/TabBar";
import { loadFamily, loadPantry, type SavedFamily, savePantry } from "@/lib/device";
import { type DinnerRating, likedDinners } from "@/lib/ratings";

export default function MorePage() {
  const [favorites, setFavorites] = useState<DinnerRating[]>([]);
  const [pantry, setPantry] = useState<string[]>([]);
  const [family, setFamily] = useState<SavedFamily | null>(null);

  useEffect(() => {
    setFavorites(likedDinners());
    setPantry(loadPantry());
    setFamily(loadFamily());
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

      <section className="card">
        <h2 className="section-title">Your pantry</h2>
        <p className="hint">Saved on this phone and used in every plan. Remove anything you run out of.</p>
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
          <ul className="family-summary">
            <li>
              <strong>Allergies:</strong> {family.allergies || "none"}
            </li>
            <li>
              <strong>Eating:</strong> {family.adults} adult{family.adults === 1 ? "" : "s"}
              {family.kids.length > 0 &&
                `, ${family.kids.length} kid${family.kids.length === 1 ? "" : "s"}`}
            </li>
            {family.kids.map((kid, i) => (
              <li key={i}>
                <strong>{kid.name || `Kid ${i + 1}`}:</strong>{" "}
                {kid.refuses.length ? `won't eat ${kid.refuses.join(", ")}` : "no foods listed"}
              </li>
            ))}
            <li>
              <strong>Weeknight cooking:</strong> up to {family.maxMinutes} min
            </li>
            <li>
              <strong>Lunches:</strong> {family.lunches ? "planned too" : "not planned"}
            </li>
          </ul>
        ) : (
          <p className="quiet">You&apos;ll answer a few questions when you make your first plan.</p>
        )}
        <Link href="/new" className="secondary">
          {family ? "Change these in a new plan" : "Make a plan"}
        </Link>
      </section>

      <InstallHelp />

      <TabBar active="more" />
    </main>
  );
}
