import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
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

// Pictures and other files that aren't JSON.
export async function readBytes(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (useBlob()) {
    const result = await get(name, { access: "private", useCache: false });
    if (!result?.stream) return null;
    return {
      bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
      contentType: result.blob.contentType ?? "application/octet-stream",
    };
  }
  try {
    const bytes = await readFile(path.join(LOCAL_ROOT, name));
    return { bytes, contentType: name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg" };
  } catch {
    return null;
  }
}

export async function writeBytes(name: string, bytes: Buffer, contentType: string) {
  if (useBlob()) {
    await put(name, bytes, { access: "private", contentType, allowOverwrite: true });
  } else if (process.env.VERCEL) {
    throw new StorageNotSetUpError();
  } else {
    await mkdir(path.dirname(path.join(LOCAL_ROOT, name)), { recursive: true });
    await writeFile(path.join(LOCAL_ROOT, name), bytes);
  }
}

// Every file name under a folder, like "plans/". For the admin page.
export async function listNames(prefix: string): Promise<string[]> {
  if (useBlob()) {
    const names: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      names.push(...page.blobs.map((blob) => blob.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return names;
  }
  const entries = await readdir(path.join(LOCAL_ROOT, prefix), { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.relative(LOCAL_ROOT, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
}

// Reads many files, a few at a time.
export async function readMany<T>(names: string[], batch = 20): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < names.length; i += batch) {
    const chunk = await Promise.all(names.slice(i, i + batch).map((name) => readJson<T>(name).catch(() => null)));
    results.push(...chunk.filter((item): item is Awaited<T> & T => item !== null));
  }
  return results;
}
