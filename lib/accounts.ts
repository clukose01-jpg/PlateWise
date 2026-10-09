import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { checkPassword, hashPassword } from "./passwords";
import { loadPlan } from "./plans";
import { sessionSecret } from "./session";
import { readJson, writeJson } from "./store";

// An account is a private file holding what each device would otherwise keep to itself: family
// answers, pantry, ratings, which plan is current, the keys that delete her plans, and her plans.

const PlanRefSchema = z.object({ id: z.string().max(40), madeOn: z.string().max(60), createdAt: z.string().max(40) });
const RatingSchema = z.object({
  planId: z.string().max(40),
  day: z.string().max(20),
  dish: z.string().max(200),
  liked: z.boolean(),
  note: z.string().max(300),
  ratedAt: z.number(),
});
const FamilySchema = z.object({
  allergies: z.union([z.array(z.string().max(60)).max(20), z.string().max(600)]),
  adults: z.number().int().min(1).max(6),
  kids: z.array(z.object({ name: z.string().max(60), refuses: z.array(z.string().max(100)).max(20) })).max(8),
  maxMinutes: z.number().int().min(10).max(120),
  lunches: z.boolean(),
});

export const AccountDataSchema = z.object({
  family: FamilySchema.nullable().catch(null),
  pantry: z.array(z.string().max(100)).max(160).catch([]),
  ratings: z.record(z.string().max(80), RatingSchema).catch({}),
  currentPlanId: z.string().max(40).nullable().catch(null),
  ownerKeys: z.record(z.string().max(40), z.string().max(100)).catch({}),
  plans: z.array(PlanRefSchema).max(200).catch([]),
});

export type AccountData = z.infer<typeof AccountDataSchema>;
export type Account = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  data: AccountData;
  // A salted fingerprint of her password, if she made one. Never sent to any device.
  passwordHash?: string;
};

export const EMPTY_DATA: AccountData = {
  family: null,
  pantry: [],
  ratings: {},
  currentPlanId: null,
  ownerKeys: {},
  plans: [],
};

const MAX_RATINGS = 300;
const MAX_PLANS = 100;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// The same email always gives the same account.
export function accountIdFor(email: string) {
  return createHash("sha256").update(`platewise-account:${normalizeEmail(email)}`).digest("hex").slice(0, 32);
}

export async function loadAccount(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  return readJson<Account>(`accounts/${id}.json`);
}

export async function saveAccountData(account: Account, data: AccountData) {
  const saved: Account = { ...account, data: trim(data), updatedAt: new Date().toISOString() };
  await writeJson(`accounts/${account.id}.json`, saved);
  return saved;
}

function trim(data: AccountData): AccountData {
  const ratings = Object.entries(data.ratings)
    .sort(([, a], [, b]) => b.ratedAt - a.ratedAt)
    .slice(0, MAX_RATINGS);
  return {
    ...data,
    ratings: Object.fromEntries(ratings),
    plans: [...data.plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_PLANS),
  };
}

// The first time a device logs in, what's on it joins what the account already has.
export function mergeData(account: AccountData, device: AccountData): AccountData {
  const pantry = [...account.pantry];
  for (const item of device.pantry) {
    if (!pantry.some((p) => p.toLowerCase() === item.toLowerCase())) pantry.push(item);
  }
  const ratings = { ...device.ratings };
  for (const [key, rating] of Object.entries(account.ratings)) {
    if (!ratings[key] || ratings[key].ratedAt < rating.ratedAt) ratings[key] = rating;
  }
  const plans = [...account.plans];
  for (const plan of device.plans) {
    if (!plans.some((p) => p.id === plan.id)) plans.push(plan);
  }
  // Open to the newer of the two current plans. A plan someone shared isn't in her list, so the
  // device's current plan wins then: it's the one she's been looking at.
  const made = (id: string | null) => plans.find((p) => p.id === id)?.createdAt ?? null;
  const accountMade = made(account.currentPlanId);
  const deviceMade = made(device.currentPlanId);
  const currentPlanId =
    !device.currentPlanId || (accountMade && deviceMade && accountMade > deviceMade)
      ? account.currentPlanId
      : device.currentPlanId;
  return trim({
    family: account.family ?? device.family,
    pantry,
    ratings,
    currentPlanId,
    ownerKeys: { ...device.ownerKeys, ...account.ownerKeys },
    plans,
  });
}

// Makes sure the plan the app opens to still exists. A device can remember a plan that was
// deleted elsewhere; then the newest plan that still exists is used instead, and missing ones are
// dropped from her list.
const PLANS_TO_TRY = 5;

export async function withLivePlan(data: AccountData): Promise<{ data: AccountData; changed: boolean }> {
  if (data.currentPlanId && (await loadPlan(data.currentPlanId))) return { data, changed: false };
  const missing = new Set(data.currentPlanId ? [data.currentPlanId] : []);
  let currentPlanId: string | null = null;
  for (const plan of data.plans.filter((p) => !missing.has(p.id)).slice(0, PLANS_TO_TRY)) {
    if (await loadPlan(plan.id)) {
      currentPlanId = plan.id;
      break;
    }
    missing.add(plan.id);
  }
  return {
    data: { ...data, currentPlanId, plans: data.plans.filter((p) => !missing.has(p.id)) },
    changed: true,
  };
}

export async function logIn(email: string, device: AccountData, known?: Account) {
  const id = accountIdFor(email);
  const existing = known ?? (await loadAccount(id));
  const now = new Date().toISOString();
  const account: Account = existing ?? { id, email: normalizeEmail(email), createdAt: now, updatedAt: now, data: EMPTY_DATA };
  const { data } = await withLivePlan(existing ? mergeData(existing.data, device) : device);
  return saveAccountData(account, data);
}

// Login codes: 6 digits, good for 10 minutes and 5 tries. Only a fingerprint of the code is saved.
const CODE_MINUTES = 10;
const MAX_TRIES = 5;
const SECONDS_BETWEEN_CODES = 30;
const CODES_PER_HOUR = 5;

type SavedCode = { codeHash: string; expiresAt: number; tries: number; sentAt: number[] };

function codeFile(email: string) {
  return `login-codes/${accountIdFor(email)}.json`;
}

function hashCode(email: string, code: string) {
  return createHmac("sha256", sessionSecret() ?? "").update(`${normalizeEmail(email)}:${code}`).digest("hex");
}

export class TooManyCodesError extends Error {}

export async function newLoginCode(email: string) {
  const saved = await readJson<SavedCode>(codeFile(email));
  const now = Date.now();
  const recent = (saved?.sentAt ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= CODES_PER_HOUR || (recent.length && now - recent[recent.length - 1] < SECONDS_BETWEEN_CODES * 1000)) {
    throw new TooManyCodesError();
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await writeJson(codeFile(email), {
    codeHash: hashCode(email, code),
    expiresAt: now + CODE_MINUTES * 60 * 1000,
    tries: 0,
    sentAt: [...recent, now],
  } satisfies SavedCode);
  return code;
}

export type CodeCheck = "ok" | "wrong" | "expired";

export async function checkLoginCode(email: string, code: string): Promise<CodeCheck> {
  const saved = await readJson<SavedCode>(codeFile(email));
  if (!saved || saved.expiresAt < Date.now() || saved.tries >= MAX_TRIES) return "expired";
  const given = Buffer.from(hashCode(email, code.trim()));
  const expected = Buffer.from(saved.codeHash);
  if (given.length === expected.length && timingSafeEqual(given, expected)) {
    // Each code works once.
    await writeJson(codeFile(email), { ...saved, codeHash: "", expiresAt: 0 });
    return "ok";
  }
  await writeJson(codeFile(email), { ...saved, tries: saved.tries + 1 });
  return saved.tries + 1 >= MAX_TRIES ? "expired" : "wrong";
}

export async function setPassword(account: Account, password: string) {
  const saved: Account = { ...account, passwordHash: await hashPassword(password), updatedAt: new Date().toISOString() };
  await writeJson(`accounts/${account.id}.json`, saved);
}

// Logging in with a password: 10 wrong tries in 15 minutes locks it for a while, so nobody can
// keep guessing. The emailed code still works.
const MAX_WRONG_PASSWORDS = 10;
const LOCK_MINUTES = 15;

type Attempts = { wrong: number[] };

function attemptsFile(email: string) {
  return `login-attempts/${accountIdFor(email)}.json`;
}

export type PasswordLogin = { result: "ok"; account: Account } | { result: "wrong" | "locked" };

export async function logInWithPassword(email: string, password: string, device: AccountData): Promise<PasswordLogin> {
  const now = Date.now();
  const attempts = await readJson<Attempts>(attemptsFile(email));
  const recent = (attempts?.wrong ?? []).filter((time) => now - time < LOCK_MINUTES * 60 * 1000);
  if (recent.length >= MAX_WRONG_PASSWORDS) return { result: "locked" };

  const account = await loadAccount(accountIdFor(email));
  if (!(await checkPassword(password, account?.passwordHash)) || !account) {
    await writeJson(attemptsFile(email), { wrong: [...recent, now] } satisfies Attempts);
    return { result: "wrong" };
  }
  if (recent.length) await writeJson(attemptsFile(email), { wrong: [] } satisfies Attempts);
  return { result: "ok", account: await logIn(email, device, account) };
}
