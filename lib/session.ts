import { createHmac, timingSafeEqual } from "node:crypto";

// Who's logged in, kept in a signed cookie. Only the server knows the secret that signs it, so it
// can't be faked. Logging in lasts a year, so the home-screen app doesn't keep asking.
const COOKIE = "pw_session";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function sessionSecret(): string | null {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // On your own computer, a stand-in secret is fine.
  return process.env.VERCEL ? null : "local-only-secret";
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function sessionCookie(accountId: string) {
  const secret = sessionSecret()!;
  const expires = Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS;
  const value = `${accountId}.${expires}`;
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${value}.${sign(value, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}${secure}`;
}

export function clearedSessionCookie() {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

// The logged-in account's id and when that login started (in seconds), or null.
function readSession(request: Request): { accountId: string; issuedAt: number } | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const cookie = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const [accountId, expires, signature] = cookie.slice(COOKIE.length + 1).split(".");
  if (!accountId || !expires || !signature) return null;
  const expected = Buffer.from(sign(`${accountId}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(expires) * 1000 < Date.now()) return null;
  return { accountId, issuedAt: Number(expires) - ONE_YEAR_SECONDS };
}

// The logged-in account's id, or null. Use currentAccount() to also check the login is still valid.
export function sessionAccountId(request: Request): string | null {
  return readSession(request)?.accountId ?? null;
}

export function sessionIssuedAt(request: Request): number | null {
  return readSession(request)?.issuedAt ?? null;
}
