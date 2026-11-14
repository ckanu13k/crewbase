import "server-only";
import { CREDENTIALS, SKILLS, TRADES } from "../taxonomy";
import type { Lang } from "../types";
import { jsonCall, nullable } from "./claude";
import { rulesExtract, type ProfileExtraction } from "./rules";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["trade", "yearsExperience", "nccerLevel", "skills", "credentials", "summary", "confidence"],
  properties: {
    trade: nullable({ type: "string", enum: TRADES.map((t) => t.id) }),
    yearsExperience: nullable({ type: "number", description: "Total years in the trade. Null if not stated." }),
    nccerLevel: nullable({ type: "integer", description: "Highest NCCER craft level completed (1-4). Null if not stated." }),
    skills: { type: "array", items: { type: "string", enum: SKILLS.map((s) => s.id) } },
    credentials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "expiresOn"],
        properties: {
          type: { type: "string", enum: CREDENTIALS.map((c) => c.id) },
          expiresOn: nullable({ type: "string", description: "YYYY-MM-DD only if the worker stated it" }),
        },
      },
    },
    summary: { type: "string", description: "One or two sentences in the worker's language, third person, no invented details." },
    confidence: { type: "number", description: "0-1: how clearly the text supports the fields above." },
  },
};

const SYSTEM = `You turn a construction or industrial craft worker's own words (often a voice transcript or a text message,
in English or Spanish, possibly with typos) into a structured profile.
Rules:
- Only include a skill or credential the worker clearly says they have. Never guess or infer extras.
- "Tubero" = pipefitter, "andamiero" = scaffold builder, "soldador" = welder, "ayudante" = helper.
- If they mention a card or certification that isn't in the list, leave it out.
- Years: total years in the trade. If they give a range, use the lower number.
- Lower the confidence when the text is short, vague, or contradictory.`;

export async function extractProfile(text: string, lang: Lang, tradeHint: string | null): Promise<ProfileExtraction> {
  const rules = rulesExtract(text, tradeHint);
  const ai = await jsonCall<Omit<ProfileExtraction, "source">>({
    system: SYSTEM,
    schema: SCHEMA,
    content: [{ type: "text", text: `Worker language: ${lang}. Trade they picked: ${tradeHint ?? "not picked"}.\n\nTheir words:\n"""${text.slice(0, 4000)}"""` }],
  });
  if (!ai) return rules;
  return {
    ...ai,
    trade: ai.trade ?? tradeHint,
    skills: [...new Set(ai.skills)],
    credentials: ai.credentials.filter((c, i, a) => a.findIndex((x) => x.type === c.type) === i),
    nccerLevel: ai.nccerLevel !== null && ai.nccerLevel >= 1 && ai.nccerLevel <= 4 ? ai.nccerLevel : null,
    confidence: Math.max(0, Math.min(1, ai.confidence)),
    source: "ai",
  };
}

export type { ProfileExtraction };
