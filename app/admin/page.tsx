"use client";

// A private page with how PlateWise is being used. It needs the same passcode as the setup page.

import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Illustrations";
import type { AdminStats, Count } from "@/lib/admin-stats";

const DAYS = 30;

function money(usd: number) {
  return usd < 1 ? `${(usd * 100).toFixed(1)}¢` : `$${usd.toFixed(2)}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateAndTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Plans per day over the last 30 days, by this computer's calendar.
function plansByDay(times: string[]) {
  const counts = new Map<string, number>();
  for (const time of times) counts.set(localDay(new Date(time)), (counts.get(localDay(new Date(time))) ?? 0) + 1);
  const today = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1 - i));
    return { date, count: counts.get(localDay(date)) ?? 0 };
  });
}

// The top of the scale: twice a clean whole number, so the middle line is a whole number too.
function niceMax(value: number) {
  const half = Math.max(2, Math.ceil(value / 2));
  const base = 10 ** Math.floor(Math.log10(half));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((m) => m * base).find((n) => n >= half && Number.isInteger(n));
  return 2 * (step ?? half);
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat-tile">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {note && <p className="stat-note">{note}</p>}
    </div>
  );
}

function DayChart({ times }: { times: string[] }) {
  const days = plansByDay(times);
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map((day) => day.count)));
  const ticks = [top, top / 2, 0];
  const tip = active === null ? null : days[active];

  return (
    <section className="card admin-card wide">
      <h2 className="section-title">Plans made each day</h2>
      <p className="hint">The last {DAYS} days. Point at a day to see its number.</p>
      <div className="day-chart">
        <div className="day-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="day-plot" onMouseLeave={() => setActive(null)}>
          {ticks.map((tick) => (
            <div key={tick} className="day-grid" style={{ bottom: `${(tick / top) * 100}%` }} />
          ))}
          <div className="day-columns" role="list" aria-label={`Plans made each day, last ${DAYS} days`}>
            {days.map((day, i) => (
              <div
                key={i}
                role="listitem"
                tabIndex={0}
                className="day-slot"
                aria-label={`${shortDate(day.date.toISOString())}: ${day.count} ${day.count === 1 ? "plan" : "plans"}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {day.count > 0 && <div className="day-bar" style={{ height: `${(day.count / top) * 100}%` }} />}
              </div>
            ))}
          </div>
          {tip && (
            <div
              className="chart-tip"
              style={{
                left: `${((active! + 0.5) / DAYS) * 100}%`,
                bottom: `${(tip.count / top) * 100}%`,
                // Near the edges, keep the note inside the card.
                translate: active! < 3 ? "-12px 0" : active! > DAYS - 4 ? "calc(-100% + 12px) 0" : "-50% 0",
              }}
            >
              <strong>{tip.count}</strong> {tip.count === 1 ? "plan" : "plans"}
              <span>{shortDate(tip.date.toISOString())}</span>
            </div>
          )}
        </div>
      </div>
      <div className="day-labels" aria-hidden="true">
        <span>{shortDate(days[0].date.toISOString())}</span>
        <span>{shortDate(days[Math.floor(DAYS / 2)].date.toISOString())}</span>
        <span>Today</span>
      </div>
      <details className="as-table">
        <summary>See as a table</summary>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Plans</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.date.toISOString()}>
                <td>{day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</td>
                <td className="num">{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function BarList({ title, hint, items, empty }: { title: string; hint?: string; items: Count[]; empty: string }) {
  const top = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="card admin-card">
      <h2 className="section-title">{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {items.length === 0 ? (
        <p className="quiet">{empty}</p>
      ) : (
        <ul className="bar-list">
          {items.map((item) => (
            <li key={item.label} title={`${item.label}: ${item.count}`}>
              <span className="bar-label">{item.label}</span>
              <span className="bar-track">
                <span className="bar" style={{ width: `${(item.count / top) * 100}%` }} />
                <span className="bar-value">{item.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminPage() {
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (passcode: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/stats", { headers: { "x-compare-code": passcode }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStats(result);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't load. Check your connection.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const passcode = new URLSearchParams(window.location.search).get("code") ?? "";
    setCode(passcode);
    load(passcode);
  }, [load]);

  const totals = stats?.totals;

  return (
    <main className="admin">
      <header>
        <Logo />
        <h1 className="plan-title">How PlateWise is doing</h1>
        <p className="tagline">Only you have this page&apos;s link. Places are approximate, from the internet connection.</p>
        {stats && (
          <p className="admin-updated">
            Updated {dateAndTime(stats.generatedAt)}
            <button type="button" className="link" onClick={() => code !== null && load(code)} disabled={busy}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </p>
        )}
      </header>

      {error && (
        <section className="card">
          <p className="error" role="alert">
            {error}
          </p>
        </section>
      )}
      {!stats && !error && <p className="quiet">Adding up the numbers…</p>}

      {stats && totals && (
        <>
          <div className="stat-grid">
            <Tile label="Plans made" value={totals.plans.toLocaleString()} note={`${totals.plansLast7} in the last 7 days`} />
            <Tile
              label="Families"
              value={totals.families.toLocaleString()}
              note={`${totals.returning} came back for another week`}
            />
            <Tile
              label="Accounts"
              value={totals.accounts.toLocaleString()}
              note={`${totals.accountsLast7} new this week · ${totals.withPassword} with a password`}
            />
            <Tile label="Daily reminders on" value={totals.reminders.toLocaleString()} />
            <Tile
              label="AI cost"
              value={money(totals.costTotal)}
              note={`${money(totals.costLast30)} in the last 30 days${totals.costPerPlan === null ? "" : ` · ${money(totals.costPerPlan)} a plan`}`}
            />
            <Tile
              label="Allergy safety check"
              value={`${totals.safetyFixed} fixed`}
              note={`${totals.blocked} stopped before anyone saw them`}
            />
          </div>

          <DayChart times={stats.planTimes} />

          <div className="admin-grid">
            <BarList
              title="Where people are"
              hint={
                stats.trackingSince
                  ? `Families in each place, since ${shortDate(stats.trackingSince)}.`
                  : "Starts counting with the next plan, scan or swap."
              }
              items={stats.places}
              empty="No places yet."
            />
            <BarList
              title="Allergies"
              hint="How many families listed each one."
              items={stats.allergies}
              empty="No allergies listed yet."
            />
            <BarList
              title="Foods kids won't eat"
              hint="How many families listed each one."
              items={stats.refusals}
              empty="Nothing listed yet."
            />
            <BarList
              title="Time to cook dinner"
              hint="The most minutes each family picked."
              items={stats.cookTimes}
              empty="No plans yet."
            />
            <BarList
              title="Reminder time zones"
              hint="Where the 3pm reminders go."
              items={stats.timeZones}
              empty="No reminders yet."
            />
            <section className="card admin-card">
              <h2 className="section-title">What people do</h2>
              <dl className="admin-facts">
                <dt>Dinners swapped</dt>
                <dd>{totals.swaps}</dd>
                <dt>Fridge photo scans</dt>
                <dd>{totals.scans}</dd>
                <dt>Dinners liked</dt>
                <dd>{totals.liked}</dd>
                <dt>Dinners not liked</dt>
                <dd>{totals.disliked}</dd>
                <dt>Families who want lunches</dt>
                <dd>{stats.lunchesShare === null ? "–" : `${Math.round(stats.lunchesShare * 100)}%`}</dd>
              </dl>
              <p className="hint">Likes only count families who log in. Swaps and scans are counted from Oct 9, when this page was added.</p>
            </section>
          </div>

          <section className="card admin-card wide">
            <h2 className="section-title">Accounts</h2>
            {stats.accounts.length === 0 ? (
              <p className="quiet">No one has logged in yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Last active</th>
                      <th className="num">Plans</th>
                      <th className="num">Ratings</th>
                      <th>Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.accounts.map((account) => (
                      <tr key={account.email}>
                        <td>{account.email}</td>
                        <td>{shortDate(account.joined)}</td>
                        <td>{shortDate(account.lastActive)}</td>
                        <td className="num">{account.plans}</td>
                        <td className="num">{account.ratings}</td>
                        <td>{account.hasPassword ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card admin-card wide">
            <h2 className="section-title">Newest plans</h2>
            {stats.recentPlans.length === 0 ? (
              <p className="quiet">No plans yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Made</th>
                      <th>Where</th>
                      <th>Allergies</th>
                      <th className="num">Kids</th>
                      <th className="num">Safety fixes</th>
                      <th className="num">Swaps</th>
                      <th className="num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentPlans.map((plan) => (
                      <tr key={plan.createdAt}>
                        <td>{dateAndTime(plan.createdAt)}</td>
                        <td>{plan.place ?? "–"}</td>
                        <td className="wrap">{plan.allergies}</td>
                        <td className="num">{plan.kids}</td>
                        <td className="num">{plan.safetyFixes ?? "–"}</td>
                        <td className="num">{plan.swaps}</td>
                        <td className="num">{plan.costUsd === null ? "–" : money(plan.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
