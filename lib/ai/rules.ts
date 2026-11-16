// Offline, keyword-based extraction. Used when there's no API key, when the AI call fails, and as
// a cross-check. Deliberately conservative: it only reports what it literally finds in the text.

import { CREDENTIALS, SKILLS, TRADES, isEntryTrade } from "../taxonomy";

export interface ProfileExtraction {
  trade: string | null;
  yearsExperience: number | null;
  nccerLevel: number | null;
  skills: string[];
  credentials: { type: string; expiresOn: string | null }[];
  summary: string;
  confidence: number; // 0-1
  source: "ai" | "rules";
}

const norm = (s: string) => ` ${s.toLowerCase().normalize("NFC").replace(/\s+/g, " ")} `;
const has = (text: string, kw: string) => {
  const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(text);
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20,
};

export function rulesExtract(raw: string, tradeHint: string | null = null): ProfileExtraction {
  const text = norm(raw);

  const tradeScores = TRADES.map((t) => ({ id: t.id, n: t.keywords.filter((k) => has(text, k)).length })).filter((x) => x.n > 0);
  // Most keyword hits wins; on a tie the specific trade beats an entry-level one ("forklift" + "warehouse" = forklift operator).
  tradeScores.sort((a, b) => b.n - a.n || Number(isEntryTrade(a.id)) - Number(isEntryTrade(b.id)));
  const trade = tradeHint ?? tradeScores[0]?.id ?? null;

  let years: number | null = null;
  const m = text.match(/(\d{1,2}|[a-zé]+)\s*(\+)?\s*(years?|yrs?|años|anos)/u);
  if (m) years = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]] ?? null;

  let nccerLevel: number | null = null;
  const lv = text.match(/(?:nccer|level|nivel)[^\d]{0,12}([1-4])/u);
  if (lv) nccerLevel = Number(lv[1]);

  const skills = SKILLS.filter((s) => s.keywords.some((k) => has(text, k))).map((s) => s.id);
  // Prefer the more specific card: "OSHA 30" shouldn't also count as "OSHA 10".
  let creds = CREDENTIALS.filter((c) => c.keywords.some((k) => has(text, k))).map((c) => ({ type: c.id, expiresOn: null }));
  // "OSHA 10 general industry" is the general-industry card only, unless they also mention construction.
  if (creds.some((c) => c.type === "osha10_gi") && !/construction|construcci[oó]n/u.test(text)) creds = creds.filter((c) => c.type !== "osha10");

  const found = Number(trade !== null) + Number(years !== null) + Math.min(skills.length, 3) / 3 + Number(creds.length > 0);
  return {
    trade,
    yearsExperience: years,
    nccerLevel,
    skills,
    credentials: creds,
    summary: raw.trim().slice(0, 240),
    confidence: Math.round((found / 4) * 0.7 * 100) / 100, // rules never claim more than 0.7
    source: "rules",
  };
}
