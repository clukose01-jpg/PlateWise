import { z } from "zod";
import { WOULD_PAY } from "@/lib/price";
import { savePriceAnswer } from "@/lib/price-check";

const dollars = z.number().min(0).max(1000).nullable().optional();

const PriceRequest = z.object({
  wouldPay: z.enum(WOULD_PAY),
  tooExpensive: dollars,
  greatDeal: dollars,
});

// The three price questions on the Today tab, after a family's first week.
export async function POST(request: Request) {
  const parsed = PriceRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Pick yes, maybe or no, and use numbers for the prices." }, { status: 400 });
  }
  const { wouldPay, tooExpensive, greatDeal } = parsed.data;
  try {
    await savePriceAnswer(request, {
      wouldPay,
      tooExpensive: tooExpensive ?? undefined,
      greatDeal: greatDeal ?? undefined,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Saving a price answer failed:", error);
    return Response.json({ error: "We couldn't send that. Please try again." }, { status: 502 });
  }
}
