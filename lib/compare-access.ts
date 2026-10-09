import { timingSafeEqual } from "node:crypto";

// The test, setup and admin pages only work with the passcode set in Vercel.
export function passcodeMatches(given: string) {
  const expected = process.env.COMPARE_PASSCODE ?? "";
  return (
    expected.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}

export function compareAllowed(request: Request) {
  return passcodeMatches(request.headers.get("x-compare-code") ?? "");
}
