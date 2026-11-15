import "server-only";
import { db, todayISO } from "./db";
import { evaluateMatch, rankCandidates, type MatchResult } from "./matching";
import { programsForGaps } from "./training";
import type { Credential, Job, Worker } from "./types";

export async function workerContext(workerId: string) {
  const store = await db();
  const today = todayISO();
  const [worker, creds, jobs, programs, employers] = await Promise.all([
    store.table("workers").get(workerId),
    store.table("credentials").list({ workerId } as Partial<Credential>),
    store.table("jobs").list({ status: "open" } as Partial<Job>),
    store.table("training_programs").list(),
    store.table("employers").list(),
  ]);
  const employerName = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  const evaluated = worker
    ? jobs.map((job) => ({ job, result: evaluateMatch(worker, creds, job, today), employer: employerName[job.employerId] ?? "" }))
    : [];
  const fits = evaluated.filter((e) => e.result.eligible).sort((a, b) => b.result.score - a.result.score);
  // "Almost": same trade or decent score, blocked by 1-2 gaps the worker could close.
  const close = evaluated
    .filter((e) => !e.result.eligible && e.result.gaps.filter((g) => g.blocking).length <= 2 && (e.job.trade === worker?.trade || e.result.score >= 35))
    .sort((a, b) => b.result.score - a.result.score);
  return { store, today, worker, creds, programs, fits, close };
}

export async function jobCandidates(jobId: string) {
  const store = await db();
  const today = todayISO();
  const job = await store.table("jobs").get(jobId);
  if (!job) return null;
  const [workers, creds, matches, employer, screenings] = await Promise.all([
    store.table("workers").list(),
    store.table("credentials").list(),
    store.table("matches").list({ jobId } as never),
    store.table("employers").get(job.employerId),
    store.table("screenings").list({ employerId: job.employerId } as never),
  ]);
  const screeningsByWorker: Record<string, typeof screenings> = {};
  for (const x of screenings) (screeningsByWorker[x.workerId] ??= []).push(x);
  const credsByWorker: Record<string, Credential[]> = {};
  for (const c of creds) (credsByWorker[c.workerId] ??= []).push(c);
  const ranked = rankCandidates(workers.filter((w) => w.onboardingComplete), credsByWorker, job, today);
  return { store, today, job, employer, ranked, matches, credsByWorker, workers, screeningsByWorker };
}

export function gapPrograms(result: MatchResult, programs: Parameters<typeof programsForGaps>[1], today: string) {
  return programsForGaps(result.gaps, programs, today);
}

export function workerById(workers: Worker[]) {
  return Object.fromEntries(workers.map((w) => [w.id, w]));
}
