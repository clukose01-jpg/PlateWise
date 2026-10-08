export const MODEL = "claude-opus-5-5";

// If Claude declines a request, the API retries it on a fallback model it picks.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// US dollars per million tokens. Used to show what each scan costs while testing.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
