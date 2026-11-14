import "server-only";
// Builds the optimizer's input from the live board and checks the result independently.
import { db, todayISO } from "./db";
import { evaluateMatch } from "./matching";
import { optimizeAssignments, type OptimizeResult } from "./optimizer";
import type { Credential, Employer, Job, Match, Worker } from "./types";

export interface PlanCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** Pairs below this score aren't proposed (e.g. a 10-year millwright as a shop helper). */
export const DEFAULT_MIN_SCORE = 60;

export async function buildPlan(minScore = DEFAULT_MIN_SCORE) {
  const store = await db();
  const today = todayISO();
  const [allWorkers, creds, allJobs, matches, placements, employers] = await Promise.all([
    store.table("workers").list(),
    store.table("credentials").list(),
    store.table("jobs").list(),
    store.table("matches").list(),
    store.table("placements").list(),
    store.table("employers").list(),
  ]);
  const jobs = allJobs.filter((j) => j.status === "open");
  const working = new Set(placements.filter((p) => p.status === "active").map((p) => p.workerId));
  const workers = allWorkers.filter((w) => w.onboardingComplete && !working.has(w.id));
  const credsByWorker: Record<string, Credential[]> = {};
  for (const c of creds) (credsByWorker[c.workerId] ??= []).push(c);
  const hired: Record<string, number> = {};
  for (const m of matches) if (m.stage === "hired") hired[m.jobId] = (hired[m.jobId] ?? 0) + 1;
  const openings = Object.fromEntries(jobs.map((j) => [j.id, Math.max(0, j.headcount - (hired[j.id] ?? 0))]));

  const result = optimizeAssignments({ workers, credsByWorker, jobs, openings, today, minScore });
  const checks = verifyPlan(result, workers, credsByWorker, jobs, openings, today);

  return {
    store, today, result, checks, openings,
    workers: Object.fromEntries(allWorkers.map((w) => [w.id, w])) as Record<string, Worker>,
    jobs: Object.fromEntries(jobs.map((j) => [j.id, j])) as Record<string, Job>,
    employers: Object.fromEntries(employers.map((e) => [e.id, e])) as Record<string, Employer>,
    credsByWorker,
    matches: matches as Match[],
    poolSize: workers.length,
    minScore,
    onAssignment: working.size,
  };
}

/** Re-checks every assignment against the rules engine, from scratch. */
export function verifyPlan(
  r: OptimizeResult, workers: Worker[], credsByWorker: Record<string, Credential[]>, jobs: Job[], openings: Record<string, number>, today: string,
): PlanCheck[] {
  const W = Object.fromEntries(workers.map((w) => [w.id, w]));
  const J = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const bad = { creds: 0, radius: 0, shift: 0, level: 0, other: 0 };
  for (const a of r.assignments) {
    const res = evaluateMatch(W[a.workerId], credsByWorker[a.workerId] ?? [], J[a.jobId], today);
    for (const g of res.gaps.filter((x) => x.blocking)) {
      if (g.kind === "credential_missing" || g.kind === "credential_expired") bad.creds++;
      else if (g.kind === "distance") bad.radius++;
      else if (g.kind === "shift") bad.shift++;
      else if (g.kind === "nccer_level" || g.kind === "experience") bad.level++;
      else bad.other++;
    }
  }
  const perWorker = new Map<string, number>();
  const perJob = new Map<string, number>();
  for (const a of r.assignments) {
    perWorker.set(a.workerId, (perWorker.get(a.workerId) ?? 0) + 1);
    perJob.set(a.jobId, (perJob.get(a.jobId) ?? 0) + 1);
  }
  const doubles = [...perWorker.values()].filter((n) => n > 1).length;
  const over = [...perJob.entries()].filter(([j, n]) => n > (openings[j] ?? 0)).length;
  const n = r.assignments.length;
  return [
    { label: "Required cards valid on the start date", ok: bad.creds === 0, detail: `${n - Math.min(n, bad.creds)}/${n} assignments` },
    { label: "Inside each worker's travel radius", ok: bad.radius === 0, detail: `${n - Math.min(n, bad.radius)}/${n} assignments` },
    { label: "Shift the worker said they'll take", ok: bad.shift === 0, detail: `${n - Math.min(n, bad.shift)}/${n} assignments` },
    { label: "NCCER level and experience met", ok: bad.level === 0, detail: `${n - Math.min(n, bad.level)}/${n} assignments` },
    { label: "Nobody booked on two jobs", ok: doubles === 0, detail: doubles ? `${doubles} double-booked` : "0 double-booked" },
    { label: "No job over its open headcount", ok: over === 0, detail: over ? `${over} over` : "0 over" },
    {
      label: "At least as good as job-by-job ranking",
      ok: r.stats.filled > r.greedy.filled || (r.stats.filled === r.greedy.filled && r.assignments.reduce((a, x) => a + x.score, 0) >= r.greedy.totalScore),
      detail: `filled ${r.stats.filled} vs ${r.greedy.filled}`,
    },
  ];
}
