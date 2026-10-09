import { timingSafeEqual } from "node:crypto";

// The test page costs real money to run, so it only works with the passcode set in Vercel.
export function compareAllowed(request: Request) {
  const expected = process.env.COMPARE_PASSCODE ?? "";
  const given = request.headers.get("x-compare-code") ?? "";
  return (
    expected.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}
