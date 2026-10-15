import { createHash } from "node:crypto";
import { PLANNED_PRICE, type WouldPay } from "./price";
import { deleteJson, listNames, readMany, writeJson } from "./store";
import { usageKey } from "./usage";

// After a family's first week, three questions about price: would they keep using PlateWise at
// the planned price, and at what monthly price it would feel too expensive, or a great deal. One
// file per family (account, or else device), so answering again replaces the old answer. The
// file has no name, email or device, so answers can't be traced back to a person.

export type PriceAnswer = {
  at: string;
  // The price she was asked about, in case it changes later.
  price: number;
  wouldPay: WouldPay;
  tooExpensive?: number;
  greatDeal?: number;
};

function answerFile(who: string) {
  return `price-checks/${createHash("sha256").update(who).digest("hex").slice(0, 32)}.json`;
}

export async function savePriceAnswer(request: Request, answer: Omit<PriceAnswer, "at" | "price">) {
  await writeJson(answerFile(usageKey(request)), {
    ...answer,
    at: new Date().toISOString(),
    price: PLANNED_PRICE,
  } satisfies PriceAnswer);
}

export async function allPriceAnswers(): Promise<PriceAnswer[]> {
  const answers = await readMany<PriceAnswer>(await listNames("price-checks/"));
  return answers.sort((a, b) => b.at.localeCompare(a.at));
}

// For "Delete my account".
export async function forgetPriceAnswer(accountId: string) {
  await deleteJson(answerFile(`account:${accountId}`)).catch(() => {});
}
