// Keeps this device and her account in step. The device's own storage stays the working copy, so
// everything works the same logged out; when she's logged in, each change is also saved to her
// account, and opening the app brings in changes made on her other devices.

const ACCOUNT_KEY = "platewise.account";

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
      const { data } = await response.json();
      applyData(data);
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

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

export async function loginStatus(): Promise<{ enabled: boolean; email: string | null }> {
  try {
    const status = await fetch("/api/auth/status", { cache: "no-store" }).then((r) => r.json());
    // Keep the device's note of who's logged in matched with the server.
    if (status.email !== accountEmail()) setAccountEmail(status.email);
    return { enabled: Boolean(status.enabled), email: status.email ?? null };
  } catch {
    return { enabled: false, email: accountEmail() };
  }
}

export async function sendCode(email: string) {
  await postJson("/api/auth/send-code", { email });
}

// Logs in with the emailed code. What's on this device joins her account.
export async function verifyCode(email: string, code: string) {
  const result = await postJson("/api/auth/verify", { email, code, device: deviceData() });
  applyData(result.data);
  setAccountEmail(result.email);
  pulling = Promise.resolve();
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
