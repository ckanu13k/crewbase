import "server-only";
// Business defaults an admin can change in Admin → Settings. Stored in app_settings; anything not
// saved falls back to the defaults here (which were estimates to start from).
import { db, nowISO } from "./db";

export const SETTING_DEFS = {
  feeEntry: { label: "Placement fee — helper / entry", unit: "$", min: 0, max: 50000, def: 3000 },
  feeMid: { label: "Placement fee — mid-level", unit: "$", min: 0, max: 50000, def: 4000 },
  feeJourney: { label: "Placement fee — journey-level", unit: "$", min: 0, max: 50000, def: 5000 },
  feeDueDay: { label: "Fee due after day", unit: "days", min: 0, max: 120, def: 30 },
  guaranteeDays: { label: "Replacement guarantee", unit: "days", min: 0, max: 365, def: 90 },
  screeningPriceBackground: { label: "Background check price", unit: "$", min: 0, max: 1000, def: 65 },
  screeningPriceDrug: { label: "Drug screen price", unit: "$", min: 0, max: 1000, def: 75 },
  screeningValidBackground: { label: "Background check valid for", unit: "days", min: 1, max: 730, def: 365 },
  screeningValidDrug: { label: "Drug screen valid for", unit: "days", min: 1, max: 365, def: 30 },
  adverseWaitDays: { label: "Wait before final adverse notice", unit: "business days", min: 5, max: 30, def: 5 },
  optimizerMinScore: { label: "Optimizer minimum match score", unit: "/100", min: 0, max: 100, def: 60 },
  trainingReviewDays: { label: "Re-check training requirements every", unit: "days", min: 7, max: 365, def: 90 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export type Settings = Record<SettingKey, number>;

export const DEFAULT_SETTINGS = Object.fromEntries(Object.entries(SETTING_DEFS).map(([k, v]) => [k, v.def])) as Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await (await db()).table("app_settings").list();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.id in SETTING_DEFS && typeof r.value === "number" && Number.isFinite(r.value)) out[r.id as SettingKey] = r.value;
  }
  return out;
}

/** Validates and saves; returns the keys that changed. */
export async function saveSettings(input: Partial<Record<SettingKey, number>>, by: string): Promise<string[]> {
  const store = await db();
  const current = await getSettings();
  const changed: string[] = [];
  for (const [k, raw] of Object.entries(input) as [SettingKey, number][]) {
    const def = SETTING_DEFS[k];
    if (!def || !Number.isFinite(raw)) continue;
    const v = Math.min(def.max, Math.max(def.min, Math.round(raw)));
    if (v === current[k]) continue;
    await store.table("app_settings").upsert({ id: k, value: v, updatedAt: nowISO(), updatedBy: by });
    changed.push(`${def.label}: ${current[k]} → ${v}`);
  }
  return changed;
}

/** Placement fee for a job from the current settings. */
export function feeFor(j: { trade: string; minYears: number; minNccerLevel: number; requiredCredentials: string[] }, s: Settings): number {
  if (j.trade === "helper" || j.minYears < 2) return s.feeEntry;
  if (j.minNccerLevel >= 3 || j.minYears >= 5 || j.requiredCredentials.some((c) => c.includes("journeyman") || c.includes("master"))) return s.feeJourney;
  return s.feeMid;
}

export const screeningPrice = (kind: "background" | "drug", s: Settings) => (kind === "background" ? s.screeningPriceBackground : s.screeningPriceDrug);
export const screeningValidDays = (kind: "background" | "drug", s: Settings) => (kind === "background" ? s.screeningValidBackground : s.screeningValidDrug);
