import { type Sealed, sealJson, unsealJson } from "./email-settings";
import { deleteJson, readJson, writeJson } from "./store";

// The key that makes dinner pictures, saved from the setup page (scrambled, like the Gmail
// password) or set in Vercel: GOOGLE_AI_API_KEY for Google, HIGGSFIELD_CREDENTIALS
// ("KEY_ID:KEY_SECRET") for Higgsfield. No key means no pictures.
const FILE = "settings/photos.json";
// Checked at most once a minute per server, so turning pictures on or off takes up to a minute.
const CACHE_MS = 60 * 1000;

export type PhotoProvider = "google" | "higgsfield";
// Keys saved before Higgsfield was added are Google's.
type Saved = { key: Sealed; model?: string; provider?: PhotoProvider };
export type PhotoKey = { provider: PhotoProvider; apiKey: string; model?: string; fromVercel?: boolean };

let cached: { value: PhotoKey | null; at: number } | null = null;

function fromVercel(): PhotoKey | null {
  const higgsfield = process.env.HIGGSFIELD_CREDENTIALS?.trim();
  if (higgsfield) return { provider: "higgsfield", apiKey: higgsfield, fromVercel: true };
  const google = process.env.GOOGLE_AI_API_KEY?.trim();
  return google ? { provider: "google", apiKey: google, fromVercel: true } : null;
}

export async function photoKey(): Promise<PhotoKey | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const saved = await readJson<Saved>(FILE).catch(() => null);
  const apiKey = saved ? unsealJson<string>(saved.key) : null;
  const savedProvider = saved ? (saved.provider ?? "google") : null;
  const vercel = fromVercel();
  const value: PhotoKey | null = vercel
    ? { ...vercel, model: savedProvider === vercel.provider ? saved?.model : undefined }
    : apiKey && savedProvider
      ? { provider: savedProvider, apiKey, model: saved?.model }
      : null;
  cached = { value, at: Date.now() };
  return value;
}

export async function photosAreOn() {
  return Boolean(await photoKey());
}

export async function savePhotoKey(provider: PhotoProvider, apiKey: string, model: string) {
  await writeJson(FILE, { key: sealJson(apiKey), model, provider } satisfies Saved);
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
