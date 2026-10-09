import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { Family, Plan, TestInfo } from "./plan-schema";

export type SavedPlan = {
  id: string;
  // When the plan was made. Plans made before this was added don't have it.
  createdAt?: string;
  family: Family;
  plan: Plan;
  test: TestInfo;
};

// Older plans stored prep as one flat list and had no night-before steps.
type StoredDinner = Omit<Plan["dinners"][number], "nightBefore"> & { nightBefore?: string[] };
export type StoredPlan = Omit<SavedPlan, "plan"> & {
  plan: Omit<Plan, "prepList" | "dinners"> & {
    prepList: Plan["prepList"] | string[];
    dinners: StoredDinner[];
  };
};

export type PrepGroup = { day: string; steps: string[] };

export function prepGroups(plan: StoredPlan["plan"]): PrepGroup[] {
  const list = plan.prepList;
  if (list.length > 0 && typeof list[0] === "string") {
    return [{ day: "", steps: list as string[] }];
  }
  return list as PrepGroup[];
}

// Online, plans are saved as private files in Vercel Blob storage.
// On your own computer, they're saved in a .data folder instead.
const LOCAL_DIR = path.join(process.cwd(), ".data", "plans");
const ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

export class StorageNotSetUpError extends Error {}

export function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function savePlan(data: Omit<SavedPlan, "id" | "createdAt">): Promise<string> {
  // 12 random characters: impossible to guess, short enough to text.
  const id = randomBytes(9).toString("base64url");
  const json = JSON.stringify({ id, createdAt: new Date().toISOString(), ...data });

  if (useBlob()) {
    await put(`plans/${id}.json`, json, { access: "private", contentType: "application/json" });
  } else if (process.env.VERCEL) {
    throw new StorageNotSetUpError();
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, `${id}.json`), json);
  }
  return id;
}

// Saves a changed plan over the old one, like after swapping a dinner.
export async function updatePlan(stored: StoredPlan) {
  const json = JSON.stringify(stored);
  if (useBlob()) {
    await put(`plans/${stored.id}.json`, json, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
  } else if (process.env.VERCEL) {
    throw new StorageNotSetUpError();
  } else {
    await writeFile(path.join(LOCAL_DIR, `${stored.id}.json`), json);
  }
}

export async function loadPlan(id: string): Promise<StoredPlan | null> {
  if (!ID_PATTERN.test(id)) return null;

  if (useBlob()) {
    // Plans can change after a swap, so always read the latest copy.
    const result = await get(`plans/${id}.json`, { access: "private", useCache: false });
    if (!result?.stream) return null;
    return new Response(result.stream).json();
  }
  try {
    return JSON.parse(await readFile(path.join(LOCAL_DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}
