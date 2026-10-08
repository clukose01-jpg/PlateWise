import Anthropic from "@anthropic-ai/sdk";

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

// Spaces or line breaks copied along with the key make Claude reject it.
function apiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() ?? "";
}

// Catches common copy-paste mistakes before calling Claude, with a message that says what to fix.
export function apiKeyProblem(): string | null {
  const key = apiKey();
  if (!key) return "The app isn't set up yet: ANTHROPIC_API_KEY is missing.";
  if (!key.startsWith("sk-ant-")) {
    return "The ANTHROPIC_API_KEY in Vercel doesn't look like a Claude key. It should start with sk-ant-.";
  }
  return null;
}

export const KEY_REJECTED =
  "Claude didn't accept the app's ANTHROPIC_API_KEY. Make a new key and paste it into Vercel again.";

export function createClient() {
  return new Anthropic({ apiKey: apiKey() });
}
