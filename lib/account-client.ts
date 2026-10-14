// Keeps this device and her account in step. The device's own storage stays the working copy, so
// everything works the same logged out; when she's logged in, each change is also saved to her
// account, and opening the app brings in changes made on her other devices.

const ACCOUNT_KEY = "platewise.account";
const NAME_KEY = "platewise.accountName";
// Set for the rest of the visit after she signs up, so the top of the screen says "Welcome"
// instead of "Welcome back".
const NEW_ACCOUNT_KEY = "platewise.newAccount";
// Sent when who's logged in, or their name, changes, so the account badge can update.
export const ACCOUNT_CHANGED = "platewise:account";

// The saved things that belong to her account, and where each lives on the device.
const SYNCED = {
  family: "platewise.family",
  pantry: "platewise.pantry",
  ratings: "platewise.ratings",
  currentPlanId: "platewise.currentPlan",
  ownerKeys: "platewise.ownerKeys",
  plans: "platewise.plans",
} as const;

type Field = keyof typeof SYNCED;
export type AccountData = Record<Field, unknown>;

const EMPTY: Record<Field, unknown> = {
  family: null,
  pantry: [],
  ratings: {},
  currentPlanId: null,
  ownerKeys: {},
  plans: [],
};

const SYNCED_KEYS = new Set<string>(Object.values(SYNCED));

export function isSyncedKey(key: string) {
  return SYNCED_KEYS.has(key);
}

// The email she's logged in with on this device, or null.
export function accountEmail(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function setAccountEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(ACCOUNT_KEY, email);
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Not remembered.
  }
  if (!email) setAccountName(null);
  window.dispatchEvent(new Event(ACCOUNT_CHANGED));
}

// Her first name, if she gave one.
export function accountName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

function setAccountName(name: string | null) {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // Not remembered.
  }
  window.dispatchEvent(new Event(ACCOUNT_CHANGED));
}

export function isNewAccount() {
  try {
    return sessionStorage.getItem(NEW_ACCOUNT_KEY) === "1";
  } catch {
    return false;
  }
}

export function deviceData(): AccountData {
  const data = { ...EMPTY };
  for (const [field, key] of Object.entries(SYNCED) as [Field, string][]) {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      if (value !== null) data[field] = value;
    } catch {
      // Leave it empty.
    }
  }
  return data;
}

function applyData(data: Partial<AccountData>) {
  for (const [field, key] of Object.entries(SYNCED) as [Field, string][]) {
    const value = data[field];
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // This browser blocks storage.
    }
  }
}

function clearData() {
  for (const key of Object.values(SYNCED)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  }
}

// Once per app open: bring in what's saved in her account. Pages wait for this before reading.
let pulling: Promise<void> | null = null;

export function syncFromAccount(): Promise<void> {
  if (typeof window === "undefined" || !accountEmail()) return Promise.resolve();
  pulling ??= (async () => {
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (response.status === 401) {
        // Logged out somewhere else, or the login expired. Her things stay on this device.
        setAccountEmail(null);
        return;
      }
      if (!response.ok) return;
      const { data, name } = await response.json();
      applyData(data);
      setAccountName(name ?? null);
    } catch {
      // Offline: use what's on the device.
    }
  })();
  // Don't keep her waiting long on a slow connection.
  return Promise.race([pulling, new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
}

// After a change, save to her account a moment later, so quick changes go together.
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAccountSave() {
  if (typeof window === "undefined" || !accountEmail()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToAccount, 800);
}

function saveToAccount() {
  saveTimer = null;
  fetch("/api/account", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: deviceData() }),
    // Finishes even if she closes the app right after a change.
    keepalive: true,
  }).catch(() => {
    // Offline: the next change saves everything again.
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveToAccount();
    }
  });
}

// "exists" is set when she tried to sign up with an email that already has an account.
export class AccountError extends Error {
  constructor(
    message: string,
    readonly exists = false,
  ) {
    super(message);
  }
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AccountError(result.error || "Something went wrong. Please try again.", Boolean(result.exists));
  }
  return result;
}

export type LoginStatus = { enabled: boolean; email: string | null; name: string | null; hasPassword: boolean };

export async function loginStatus(): Promise<LoginStatus> {
  try {
    const status = await fetch("/api/auth/status", { cache: "no-store" }).then((r) => r.json());
    // Keep the device's note of who's logged in, and their name, matched with the server.
    if (status.email !== accountEmail()) setAccountEmail(status.email);
    if (status.email && (status.name ?? null) !== accountName()) setAccountName(status.name ?? null);
    return {
      enabled: Boolean(status.enabled),
      email: status.email ?? null,
      name: status.name ?? null,
      hasPassword: Boolean(status.hasPassword),
    };
  } catch {
    return { enabled: false, email: accountEmail(), name: accountName(), hasPassword: false };
  }
}

export async function sendCode(email: string) {
  await postJson("/api/auth/send-code", { email });
}

function loggedIn(result: { email: string; name?: string | null; data: Partial<AccountData> }) {
  applyData(result.data);
  setAccountEmail(result.email);
  setAccountName(result.name ?? null);
  pulling = Promise.resolve();
}

// Logs in with the emailed code. What's on this device joins her account.
// Says whether she already has a password, so she can be offered one.
export async function verifyCode(email: string, code: string): Promise<{ hasPassword: boolean }> {
  const result = await postJson("/api/auth/verify", { email, code, device: deviceData() });
  loggedIn(result);
  return { hasPassword: Boolean(result.hasPassword) };
}

// A new account with an email and password. What's on this device becomes the account's start.
export async function signUp(email: string, password: string, name: string) {
  loggedIn(await postJson("/api/auth/signup", { email, password, name, device: deviceData() }));
  try {
    sessionStorage.setItem(NEW_ACCOUNT_KEY, "1");
  } catch {
    // Says "Welcome back" instead.
  }
}

// Adds or changes her first name.
export async function saveName(name: string) {
  const result = await postJson("/api/auth/name", { name });
  setAccountName(result.name ?? null);
  return (result.name ?? null) as string | null;
}

export async function logInWithPassword(email: string, password: string) {
  loggedIn(await postJson("/api/auth/password-login", { email, password, device: deviceData() }));
}

export async function setPassword(password: string) {
  await postJson("/api/auth/password", { password });
}

// Deletes her account and the plans she made, then clears everything PlateWise saved on this
// device. The admin passcode, if this is the admin's device, stays.
export async function deleteAccount() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  await postJson("/api/auth/delete-account", { ownerKeys: deviceData().ownerKeys });
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("platewise.") && key !== "platewise.adminCode") localStorage.removeItem(key);
    }
    sessionStorage.removeItem(NEW_ACCOUNT_KEY);
  } catch {
    // Nothing more to clear.
  }
  pulling = null;
  setAccountEmail(null);
}

// Logging out takes her things off this device; they stay saved in her account.
export async function logOut() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveToAccount();
  }
  await postJson("/api/auth/logout", {});
  clearData();
  setAccountEmail(null);
}
