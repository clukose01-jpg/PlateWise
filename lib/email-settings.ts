import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sessionSecret } from "./session";
import { readJson, writeJson } from "./store";

// The Gmail account that sends login codes, saved from the app's setup page instead of Vercel's
// settings. The app password is stored scrambled (AES-256-GCM) with a key made from SESSION_SECRET,
// so the file on its own is useless.
const FILE = "settings/email.json";
const CACHE_MS = 5 * 60 * 1000;

export type GmailAccount = { user: string; pass: string };
export type Sealed = { iv: string; tag: string; data: string };

function key() {
  const secret = sessionSecret();
  return secret ? createHash("sha256").update(`platewise-settings:${secret}`).digest() : null;
}

// Scrambles a setting so the saved file is useless without SESSION_SECRET. Also used for the
// key that makes dinner pictures.
export function sealJson(value: unknown): Sealed {
  const secretKey = key();
  if (!secretKey) throw new Error("SESSION_SECRET isn't set.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function unsealJson<T>(sealed: Sealed): T | null {
  const secretKey = key();
  if (!secretKey) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey, Buffer.from(sealed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    const json = Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
    return JSON.parse(json.toString("utf8"));
  } catch {
    return null;
  }
}

let cached: { account: GmailAccount | null; at: number } | null = null;

export async function savedGmail(): Promise<GmailAccount | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.account;
  const sealed = key() ? await readJson<Sealed>(FILE).catch(() => null) : null;
  const account = sealed ? unsealJson<GmailAccount>(sealed) : null;
  cached = { account, at: Date.now() };
  return account;
}

export async function saveGmail(account: GmailAccount) {
  await writeJson(FILE, sealJson(account));
  cached = { account, at: Date.now() };
}
