import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import AccountBadge from "@/components/AccountBadge";
import { Logo } from "@/components/Illustrations";
import TabBar from "@/components/TabBar";
import { WEEKLY_LIMITS } from "@/lib/usage";

export const metadata: Metadata = {
  title: "Common questions · PlateWise",
};

type Question = { q: string; a: ReactNode };

// Keep these in step with what the app actually does, like the privacy page.
const GROUPS: { title: string; questions: Question[] }[] = [
  {
    title: "Getting started",
    questions: [
      {
        q: "What does PlateWise do?",
        a: (
          <p>
            Tell it what&apos;s in your kitchen and who&apos;s eating, and in a few minutes it plans dinners for
            Monday to Friday that the whole family can eat. You get one grocery list for the week and a Sunday prep
            list, so there&apos;s nothing left to decide on weeknights.
          </p>
        ),
      },
      {
        q: "Do I need an account?",
        a: (
          <p>
            No. PlateWise works without one and remembers your answers on this device. Make a free account on your
            Profile if you&apos;d like your plans, pantry and ratings on any phone or computer.
          </p>
        ),
      },
      {
        q: "Is it free?",
        a: (
          <p>
            Yes, while we test it with families. PlateWise never asks for a card, so nothing can be charged without
            you choosing to pay.
          </p>
        ),
      },
      {
        q: "How do I put it on my home screen?",
        a: (
          <ul>
            <li>
              <strong>iPhone:</strong> in Safari, tap the Share button, then <em>Add to Home Screen</em>.
            </li>
            <li>
              <strong>Android:</strong> in Chrome, tap the &#8942; menu, then <em>Add to Home screen</em> or{" "}
              <em>Install app</em>.
            </li>
          </ul>
        ),
      },
    ],
  },
  {
    title: "Your plan",
    questions: [
      {
        q: "Do I have to take photos of my fridge?",
        a: (
          <p>
            No. You can type what you have, or skip that step. Photos just make it quicker, and they&apos;re thrown
            away once your food is listed.
          </p>
        ),
      },
      {
        q: "What about picky eaters?",
        a: (
          <p>
            Add the foods each kid won&apos;t eat, and every dinner leaves them out. After dinner, tap{" "}
            <em>Liked it</em> or <em>Not for us</em>, and the next plans bring back favorites and steer away from the
            rest.
          </p>
        ),
      },
      {
        q: "How does it handle allergies?",
        a: (
          <p>
            Every dinner is planned around the allergies you list, then double-checked before you see it. Always
            check food labels too, since brands change their ingredients.
          </p>
        ),
      },
      {
        q: "Can I change a dinner?",
        a: (
          <p>
            Yes. Every dinner has <em>Swap for a different dinner</em> and <em>Move to another day</em>. On a busy
            night, tap <em>Running late?</em> on Today for a quick dinner instead.
          </p>
        ),
      },
      {
        q: "Does it plan lunches?",
        a: <p>Only if you&apos;d like: tick &ldquo;Plan lunches too&rdquo; when you answer the questions.</p>,
      },
      {
        q: "Can it stick to a grocery budget?",
        a: (
          <p>
            Yes. Add a weekly grocery budget when you answer the questions. Each dinner shows an estimated cost,
            based on prices where you live.
          </p>
        ),
      },
      {
        q: "How many plans can I make?",
        a: (
          <p>
            Each week: {WEEKLY_LIMITS.plan} new plans, {WEEKLY_LIMITS.swap} swaps and {WEEKLY_LIMITS.scan} fridge
            scans. That&apos;s plenty for a normal week. Moving a dinner and typing your food don&apos;t count.
          </p>
        ),
      },
      {
        q: "Does it get better over time?",
        a: (
          <p>
            Yes. It learns from your ratings, from the dinners you made or skipped, and from nights you were running
            late, so each week fits your family a little better.
          </p>
        ),
      },
    ],
  },
  {
    title: "Shopping and cooking",
    questions: [
      {
        q: "How do I share the plan?",
        a: (
          <p>
            Tap <em>Share this plan</em> on the Week tab to send a link to anyone who helps, like a partner or
            nanny. On the Groceries tab, <em>Send list</em> sends what&apos;s still left to buy.
          </p>
        ),
      },
      {
        q: "Does it work in a store with no signal?",
        a: (
          <p>
            Yes. Open your plan once with signal, and Today, Week and Groceries keep working without it, ticking
            things off included.
          </p>
        ),
      },
      {
        q: "What's the Sunday prep list?",
        a: (
          <p>
            Things to do ahead on Sunday, like cutting vegetables or getting meat ready, so weeknight cooking is
            faster. It&apos;s on the Groceries tab, and on Today every Sunday.
          </p>
        ),
      },
      {
        q: "How do reminders work?",
        a: (
          <p>
            Turn on <em>Daily reminder</em> on your Profile. On weeknights you get tonight&apos;s dinner in the
            afternoon, at a time you pick, and on Sundays a nudge to prep or plan. On iPhone, add PlateWise to your
            home screen first.
          </p>
        ),
      },
    ],
  },
  {
    title: "Your information",
    questions: [
      {
        q: "What does PlateWise save?",
        a: (
          <p>
            Your answers, food lists and ratings, so your plans fit your family. Fridge photos aren&apos;t saved,
            and there are no ads. The full list is in <Link href="/privacy">What we save and why</Link>.
          </p>
        ),
      },
      {
        q: "How do I delete my information?",
        a: (
          <p>
            With an account, tap <em>Delete my account</em> at the bottom of your Profile. Without one, tap{" "}
            <em>Delete this plan</em> at the bottom of the Week tab.
          </p>
        ),
      },
      {
        q: "Something's not working, or I have an idea",
        a: (
          <p>
            Use <Link href="/more#feedback">Tell us what you think</Link> on your Profile. It goes straight to the
            PlateWise admin, and you can leave your email for an answer.
          </p>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main>
      <header>
        <Logo />
        <AccountBadge />
        <h1 className="plan-title">Common questions</h1>
        <p className="tagline">Tap a question to see the answer.</p>
      </header>

      <div className="faq">
        {GROUPS.map((group) => (
          <section key={group.title} className="card">
            <h2 className="section-title">{group.title}</h2>
            {group.questions.map(({ q, a }) => (
              <details key={q}>
                <summary>
                  {q}
                  <span className="chevron" aria-hidden="true" />
                </summary>
                <div className="faq-answer">{a}</div>
              </details>
            ))}
          </section>
        ))}
      </div>

      <TabBar active="more" />
    </main>
  );
}
