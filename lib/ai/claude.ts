import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

let client: Anthropic | null | undefined;

export function claude(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  return client;
}

export const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

/**
 * One structured-output call. Returns null (never throws) when there is no key or the call fails,
 * so every caller has a rules-based fallback and onboarding never breaks on an API error.
 */
export async function jsonCall<T>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  const c = claude();
  if (!c) return null;
  try {
    const msg = await c.messages.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      output_config: { format: { type: "json_schema", schema: opts.schema } },
    });
    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text" || msg.stop_reason === "max_tokens") return null;
    return JSON.parse(text.text) as T;
  } catch (err) {
    console.error("[ai] structured call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function textCall(system: string, prompt: string, maxTokens = 400): Promise<string | null> {
  const c = claude();
  if (!c) return null;
  try {
    const msg = await c.messages.create({ model: AI_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] });
    const text = msg.content.find((b) => b.type === "text");
    return text && text.type === "text" ? text.text.trim() : null;
  } catch (err) {
    console.error("[ai] text call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
