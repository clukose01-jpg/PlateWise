import { readJson, writeJson } from "./store";

// The admin page's own settings: where the Monday email goes, and when it last went.
const FILE = "settings/admin.json";

export type AdminSettings = { weeklyEmailTo?: string; lastWeeklySentOn?: string };

export async function adminSettings(): Promise<AdminSettings> {
  return (await readJson<AdminSettings>(FILE).catch(() => null)) ?? {};
}

export async function saveAdminSettings(change: AdminSettings) {
  const settings = { ...(await adminSettings()), ...change };
  await writeJson(FILE, settings);
  return settings;
}
