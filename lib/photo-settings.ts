import { type Sealed, sealJson, unsealJson } from "./email-settings";
import { deleteJson, readJson, writeJson } from "./store";

// The Google AI key that makes dinner pictures, saved from the setup page (scrambled, like the
// Gmail password) or set as GOOGLE_AI_API_KEY in Vercel. No key means no pictures.
const FILE = "settings/photos.json";
// Checked at most once a minute per server, so turning pictures on or off takes up to a minute.
const CACHE_MS = 60 * 1000;

type Saved = { key: Sealed; model?: string };
export type PhotoKey = { apiKey: string; model?: string };

let cached: { value: PhotoKey | null; at: number } | null = null;

export async function photoKey(): Promise<PhotoKey | null> {
  const fromVercel = process.env.GOOGLE_AI_API_KEY?.trim();
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const saved = await readJson<Saved>(FILE).catch(() => null);
  const apiKey = saved ? unsealJson<string>(saved.key) : null;
  const value = fromVercel ? { apiKey: fromVercel, model: saved?.model } : apiKey ? { apiKey, model: saved?.model } : null;
  cached = { value, at: Date.now() };
  return value;
}

export async function photosAreOn() {
  return Boolean(await photoKey());
}

export async function savePhotoKey(apiKey: string, model: string) {
  await writeJson(FILE, { key: sealJson(apiKey), model } satisfies Saved);
  cached = null;
}

// Remembers which of Google's picture models answered, so later pictures go straight to it.
export async function rememberPhotoModel(model: string) {
  const saved = await readJson<Saved>(FILE).catch(() => null);
  if (saved && saved.model !== model) await writeJson(FILE, { ...saved, model });
  cached = null;
}

export async function removePhotoKey() {
  await deleteJson(FILE);
  cached = null;
}
