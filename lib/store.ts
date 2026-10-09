import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { StorageNotSetUpError, useBlob } from "./plans";

// Small private JSON files: in Vercel Blob storage online, in the .data folder on your own computer.
const LOCAL_ROOT = path.join(process.cwd(), ".data");

export async function readJson<T>(name: string): Promise<T | null> {
  if (useBlob()) {
    const result = await get(name, { access: "private", useCache: false });
    return result?.stream ? new Response(result.stream).json() : null;
  }
  try {
    return JSON.parse(await readFile(path.join(LOCAL_ROOT, name), "utf8"));
  } catch {
    return null;
  }
}

export async function writeJson(name: string, value: unknown) {
  const json = JSON.stringify(value);
  if (useBlob()) {
    await put(name, json, { access: "private", contentType: "application/json", allowOverwrite: true });
  } else if (process.env.VERCEL) {
    throw new StorageNotSetUpError();
  } else {
    await mkdir(path.dirname(path.join(LOCAL_ROOT, name)), { recursive: true });
    await writeFile(path.join(LOCAL_ROOT, name), json);
  }
}

export async function deleteJson(name: string) {
  if (useBlob()) {
    await del(name);
  } else {
    await unlink(path.join(LOCAL_ROOT, name)).catch(() => {});
  }
}
