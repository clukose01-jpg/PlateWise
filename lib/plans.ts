import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { Family, Plan, TestInfo } from "./plan-schema";

export type SavedPlan = {
  id: string;
  family: Family;
  plan: Plan;
  test: TestInfo;
};

// Online, plans are saved as private files in Vercel Blob storage.
// On your own computer, they're saved in a .data folder instead.
const LOCAL_DIR = path.join(process.cwd(), ".data", "plans");
const ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

export class StorageNotSetUpError extends Error {}

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function savePlan(data: Omit<SavedPlan, "id">): Promise<string> {
  // 12 random characters: impossible to guess, short enough to text.
  const id = randomBytes(9).toString("base64url");
  const json = JSON.stringify({ id, ...data });

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

export async function loadPlan(id: string): Promise<SavedPlan | null> {
  if (!ID_PATTERN.test(id)) return null;

  if (useBlob()) {
    const result = await get(`plans/${id}.json`, { access: "private" });
    if (!result?.stream) return null;
    return new Response(result.stream).json();
  }
  try {
    return JSON.parse(await readFile(path.join(LOCAL_DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}
