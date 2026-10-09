import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sessionSecret } from "./session";
import { readJson, writeJson } from "./store";

// The Gmail account that sends login codes, saved from the app's setup page instead of Vercel's
// settings. The app password is stored scrambled (AES-256-GCM) with a key made from SESSION_SECRET,
// so the file on its own is useless.
const FILE = "settings/email.json";
const CACHE_MS = 5 * 60 * 1000;

export type GmailAccount = { user: string; pass: string };
type Sealed = { iv: string; tag: string; data: string };

function key() {
  const secret = sessionSecret();
  return secret ? createHash("sha256").update(`platewise-settings:${secret}`).digest() : null;
}

let cached: { account: GmailAccount | null; at: number } | null = null;

export async function savedGmail(): Promise<GmailAccount | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.account;
  const secretKey = key();
  let account: GmailAccount | null = null;
  const sealed = secretKey ? await readJson<Sealed>(FILE).catch(() => null) : null;
  if (secretKey && sealed) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", secretKey, Buffer.from(sealed.iv, "base64"));
      decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
      const json = Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
      account = JSON.parse(json.toString("utf8"));
    } catch {
      account = null;
    }
  }
  cached = { account, at: Date.now() };
  return account;
}

export async function saveGmail(account: GmailAccount) {
  const secretKey = key();
  if (!secretKey) throw new Error("SESSION_SECRET isn't set.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(account), "utf8"), cipher.final()]);
  await writeJson(FILE, {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  } satisfies Sealed);
  cached = { account, at: Date.now() };
}
