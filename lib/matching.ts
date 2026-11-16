// Matching and gap engine. Pure functions: no I/O, fully unit-tested.
//
// Design rule from the product plan: gaps are computed by RULES here. The LLM only rewords
// them for the worker (lib/ai/explain.ts), so it can never invent a job requirement.

import { distanceMiles } from "./geo";
import { isEntryTrade } from "./taxonomy";
import type { Credential, Job, Verification, Worker } from "./types";

export const EXPIRING_SOON_DAYS = 60;

/** Holding the key credential also satisfies the listed ones. */
export const SATISFIES: Record<string, string[]> = {
  osha30: ["osha10"],
  tdlr_master_electrician: ["tdlr_journeyman_electrician", "tdlr_apprentice_electrician"],
  tdlr_journeyman_electrician: ["tdlr_apprentice_electrician"],
  tsbpe_journeyman: ["tsbpe_apprentice"],
};

export type CredStatus = "valid" | "expiring" | "expired" | "no_expiry";

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toISO.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function credentialStatus(c: Pick<Credential, "expiresOn">, asOf: string): CredStatus {
  if (!c.expiresOn) return "no_expiry";
  const d = daysBetween(asOf, c.expiresOn);
  if (d < 0) return "expired";
  if (d <= EXPIRING_SOON_DAYS) return "expiring";
  return "valid";
}

const VERIFICATION_WEIGHT: Record<Verification, number> = { verified: 1, document: 0.75, self: 0.4 };

/** Best credential the worker holds that satisfies `type`, judged at `asOf`. */
export function findCredential(creds: Credential[], type: string, asOf: string): Credential | null {
  const candidates = creds.filter((c) => c.type === type || (SATISFIES[c.type] ?? []).includes(type));
  if (candidates.length === 0) return null;
  const rank = (c: Credential) =>
    (credentialStatus(c, asOf) === "expired" ? 0 : 10) + VERIFICATION_WEIGHT[c.verification];
  return [...candidates].sort((a, b) => rank(b) - rank(a))[0];
}

export type GapKind =
  | "credential_missing"
  | "credential_expired"
  | "credential_expires_soon"
  | "credential_unverified"
  | "preferred_credential_missing"
  | "skill_missing"
  | "nccer_level"
  | "experience"
  | "distance"
  | "shift"
  | "trade";

export interface Gap {
  kind: GapKind;
  blocking: boolean;
  credential?: string;
  skill?: string;
  have?: number | string | null;
  need?: number | string | null;
}

export interface MatchResult {
  workerId: string;
  jobId: string;
  eligible: boolean; // no blocking gaps
  score: number; // 0-100
  distanceMiles: number | null;
  breakdown: { skills: number; credentials: number; preferred: number; experience: number; distance: number; trade: number };
  matchedSkills: string[];
  gaps: Gap[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function evaluateMatch(worker: Worker, creds: Credential[], job: Job, today: string): MatchResult {
  const gaps: Gap[] = [];
  // Credentials are judged on the job's start date: a card that expires before day 1 doesn't count.
  const asOf = job.startDate > today ? job.startDate : today;

  // --- Required credentials (blocking) ---
  let credPoints = 0;
  for (const type of job.requiredCredentials) {
    const c = findCredential(creds, type, asOf);
    if (!c) {
      gaps.push({ kind: "credential_missing", blocking: true, credential: type });
      continue;
    }
    const status = credentialStatus(c, asOf);
    if (status === "expired") {
      gaps.push({ kind: "credential_expired", blocking: true, credential: type, have: c.expiresOn, need: asOf });
      continue;
    }
    credPoints += VERIFICATION_WEIGHT[c.verification];
    if (c.verification === "self") gaps.push({ kind: "credential_unverified", blocking: false, credential: type });
    if (status === "expiring") gaps.push({ kind: "credential_expires_soon", blocking: false, credential: type, have: c.expiresOn });
  }
  const credentials = job.requiredCredentials.length ? (credPoints / job.requiredCredentials.length) * 25 : 25;

  // --- Preferred credentials (non-blocking) ---
  let prefHits = 0;
  for (const type of job.preferredCredentials) {
    const c = findCredential(creds, type, asOf);
    if (c && credentialStatus(c, asOf) !== "expired") prefHits += 1;
    else gaps.push({ kind: "preferred_credential_missing", blocking: false, credential: type });
  }
  const preferred = job.preferredCredentials.length ? (prefHits / job.preferredCredentials.length) * 10 : 10;

  // --- Skills ---
  const have = new Set(worker.skills);
  const matchedSkills = job.requiredSkills.filter((s) => have.has(s));
  for (const s of job.requiredSkills) if (!have.has(s)) gaps.push({ kind: "skill_missing", blocking: false, skill: s });
  const skills = job.requiredSkills.length ? (matchedSkills.length / job.requiredSkills.length) * 35 : 35;

  // --- NCCER level and experience ---
  if (worker.nccerLevel < job.minNccerLevel) {
    gaps.push({ kind: "nccer_level", blocking: true, have: worker.nccerLevel, need: job.minNccerLevel });
  }
  const years = worker.yearsExperience ?? 0;
  if (years < job.minYears) {
    // Within a year of the minimum is a recruiter judgment call, not a hard no.
    gaps.push({ kind: "experience", blocking: job.minYears - years > 1, have: years, need: job.minYears });
  }
  const experience = job.minYears > 0 ? Math.min(years / job.minYears, 1.25) * 12 : 12;

  // --- Trade ---
  let trade = 8;
  if (worker.trade !== job.trade) {
    trade = 0;
    // Someone from another trade qualifies only if they already have at least half the job's skills
    // (a welder who fits pipe can take a fitter job; an electrician can't). Entry-level jobs (helper,
    // warehouse associate, picker/packer, mover, cleaner, landscaper) are open to anyone.
    const crossesOver = isEntryTrade(job.trade) || (job.requiredSkills.length > 0 && matchedSkills.length * 2 >= job.requiredSkills.length);
    gaps.push({ kind: "trade", blocking: !crossesOver, have: worker.trade, need: job.trade });
  }

  // --- Shift ---
  if (worker.shifts.length > 0 && !worker.shifts.includes(job.shift)) {
    gaps.push({ kind: "shift", blocking: true, have: worker.shifts.join(","), need: job.shift });
  }

  // --- Distance ---
  const miles = distanceMiles(worker, job);
  let distance = 5; // unknown distance: neutral
  if (miles !== null) {
    const limit = worker.radiusMiles > 0 ? worker.radiusMiles : 75;
    if (worker.radiusMiles > 0 && miles > worker.radiusMiles) {
      gaps.push({ kind: "distance", blocking: true, have: round1(miles), need: worker.radiusMiles });
      distance = 0;
    } else {
      distance = 10 * Math.max(0, 1 - miles / limit);
    }
  }

  const breakdown = {
    skills: round1(skills),
    credentials: round1(credentials),
    preferred: round1(preferred),
    experience: round1(experience),
    distance: round1(distance),
    trade,
  };
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const eligible = !gaps.some((g) => g.blocking);
  // Ineligible candidates are still ranked (for "close" lists) but capped below every eligible one.
  const score = Math.round(eligible ? Math.min(raw, 100) : Math.min(raw, 100) * 0.5);

  return { workerId: worker.id, jobId: job.id, eligible, score, distanceMiles: miles === null ? null : round1(miles), breakdown, matchedSkills, gaps };
}

export function rankCandidates(workers: Worker[], credsByWorker: Record<string, Credential[]>, job: Job, today: string) {
  return workers
    .map((w) => ({ worker: w, result: evaluateMatch(w, credsByWorker[w.id] ?? [], job, today) }))
    .sort((a, b) => Number(b.result.eligible) - Number(a.result.eligible) || b.result.score - a.result.score);
}

/** Gaps the worker can act on with training, most important first. */
export function trainableGaps(gaps: Gap[]): Gap[] {
  const order: GapKind[] = ["credential_missing", "credential_expired", "nccer_level", "credential_expires_soon", "skill_missing", "preferred_credential_missing"];
  return gaps.filter((g) => order.includes(g.kind)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
