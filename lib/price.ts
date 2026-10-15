// What PlateWise plans to charge, and the answers to "Would you keep using it at that price?".
// Kept apart from price-check.ts so the browser can use it too.
export const PLANNED_PRICE = 6.99;
export const WOULD_PAY = ["yes", "maybe", "no"] as const;
export type WouldPay = (typeof WOULD_PAY)[number];
