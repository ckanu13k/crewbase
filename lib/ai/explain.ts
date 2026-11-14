import "server-only";
import type { Lang } from "../types";
import { textCall } from "./claude";

/**
 * Turns rule-computed gap facts into a short, encouraging note. The model may only reword the facts;
 * the rules in lib/matching.ts decide what's missing. Falls back to the facts themselves.
 */
export async function explainGaps(jobTitle: string, facts: string[], programs: string[], lang: Lang): Promise<string> {
  const fallback = facts.join(" ");
  if (facts.length === 0) return fallback;
  if (process.env.AI_EXPLAIN !== "on") return fallback; // off by default: costs a call per job view
  const out = await textCall(
    `You write 2-3 short sentences to a craft worker about what they're missing for a job, in ${lang === "es" ? "simple Mexican/Texan Spanish" : "plain English"}.
Use ONLY the facts and programs given. Do not add requirements, dates, prices or promises. No greetings, no emoji.`,
    `Job: ${jobTitle}\nFacts:\n- ${facts.join("\n- ")}\nTraining options:\n- ${programs.join("\n- ") || "none listed"}`,
  );
  return out ?? fallback;
}
