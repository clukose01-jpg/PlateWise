import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Passwords are never saved, only a slow, salted fingerprint (scrypt), so even someone who read
// the account files couldn't work them out.
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 8;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

// Takes the same time whether or not there's a saved password, so it doesn't hint which emails
// have accounts.
const DUMMY = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEY_LENGTH).toString("base64")}`;

export async function checkPassword(password: string, saved: string | undefined) {
  const [kind, salt, key] = (saved ?? DUMMY).split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const given = await derive(password, Buffer.from(salt, "base64"));
  return Boolean(saved) && given.length === expected.length && timingSafeEqual(given, expected);
}
