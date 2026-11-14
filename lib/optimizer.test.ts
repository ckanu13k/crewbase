import { describe, expect, it } from "vitest";
import { evaluateMatch } from "./matching";
import { optimizeAssignments } from "./optimizer";
import { seedData } from "./db/seed";
import type { Credential, Job, Worker } from "./types";

const TODAY = "2026-11-13";

// Small deterministic PRNG so random boards are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const ZIPS = ["77506", "77536", "77520", "77015", "77587", "77029", "77072", "77084", "77449", "77571", "77581", "77002"];
const TRADES = ["pipefitter", "welder", "scaffold", "helper"];
const SKILLS: Record<string, string[]> = {
  pipefitter: ["pipe_isometrics", "carbon_steel_pipe", "flange_boltup", "hydrotest"],
  welder: ["smaw", "gtaw", "pipe_6g", "weld_symbols"],
  scaffold: ["frame_scaffold", "tube_clamp", "scaffold_tagging"],
  helper: ["material_handling", "power_tools"],
};

function board(seed: number, nW: number, nJ: number) {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const workers: Worker[] = [];
  const credsByWorker: Record<string, Credential[]> = {};
  for (let i = 0; i < nW; i++) {
    const trade = pick(TRADES);
    const id = `w${i}`;
    workers.push({
      id, phone: "", name: id, lang: "en", zip: pick(ZIPS), radiusMiles: pick([10, 20, 30, 50]), shifts: ["day", "night", "turnaround"],
      trade, yearsExperience: Math.floor(r() * 10), nccerLevel: Math.floor(r() * 4), skills: SKILLS[trade].filter(() => r() < 0.75),
      summary: "", consentSms: true, onboardingComplete: true, createdAt: TODAY,
    });
    credsByWorker[id] = ["osha10", "twic"].filter(() => r() < 0.8).map((type) => ({
      id: `${id}-${type}`, workerId: id, type, number: null, holderName: null, issuedOn: null, expiresOn: null, photoPath: null,
      verification: "verified", verifiedBy: null, verifiedMethod: null, extractionConfidence: null, needsReview: false, createdAt: TODAY,
    }));
  }
  const jobs: Job[] = [];
  for (let j = 0; j < nJ; j++) {
    const trade = pick(TRADES);
    jobs.push({
      id: `j${j}`, employerId: "e", title: trade, trade, requiredCredentials: r() < 0.5 ? ["osha10"] : ["osha10", "twic"], preferredCredentials: [],
      requiredSkills: SKILLS[trade].slice(0, 2), minNccerLevel: 0, minYears: Math.floor(r() * 4), payMin: 20, payMax: 30, shift: "day",
      zip: pick(ZIPS), startDate: "2026-12-01", headcount: 1 + Math.floor(r() * 3), placementFee: 3000, status: "open", description: "", createdAt: TODAY,
    });
  }
  return { workers, credsByWorker, jobs };
}

/** Exhaustive search: best (filled, totalScore) lexicographically. */
function bruteForce(workers: Worker[], credsByWorker: Record<string, Credential[]>, jobs: Job[]) {
  const score = workers.map((w) => jobs.map((j) => {
    const r = evaluateMatch(w, credsByWorker[w.id] ?? [], j, TODAY);
    return r.eligible ? r.score : -1;
  }));
  const left = jobs.map((j) => j.headcount);
  let best = { filled: 0, total: 0 };
  const go = (i: number, filled: number, total: number) => {
    if (i === workers.length) {
      if (filled > best.filled || (filled === best.filled && total > best.total)) best = { filled, total };
      return;
    }
    go(i + 1, filled, total); // leave this worker unassigned
    for (let j = 0; j < jobs.length; j++) {
      if (score[i][j] < 0 || left[j] === 0) continue;
      left[j]--;
      go(i + 1, filled + 1, total + score[i][j]);
      left[j]++;
    }
  };
  go(0, 0, 0);
  return best;
}

describe("optimizeAssignments", () => {
  it("matches exhaustive search on 40 random small boards", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { workers, credsByWorker, jobs } = board(seed, 7, 4);
      const res = optimizeAssignments({ workers, credsByWorker, jobs, today: TODAY });
      const best = bruteForce(workers, credsByWorker, jobs);
      const total = res.assignments.reduce((a, x) => a + x.score, 0);
      expect({ seed, filled: res.stats.filled, total }).toEqual({ seed, filled: best.filled, total: best.total });
    }
  });

  it("matches exhaustive search when there are far more workers than openings (pruning active)", () => {
    for (let seed = 500; seed < 530; seed++) {
      const { workers, credsByWorker, jobs } = board(seed, 9, 3);
      for (const j of jobs) j.headcount = 1;
      const res = optimizeAssignments({ workers, credsByWorker, jobs, today: TODAY });
      const best = bruteForce(workers, credsByWorker, jobs);
      expect({ seed, filled: res.stats.filled, total: res.assignments.reduce((a, x) => a + x.score, 0) }).toEqual({ seed, filled: best.filled, total: best.total });
    }
  });

  it("never breaks a hard constraint or double-books", () => {
    const { workers, credsByWorker, jobs } = board(99, 120, 30);
    const res = optimizeAssignments({ workers, credsByWorker, jobs, today: TODAY });
    const seen = new Set<string>();
    const perJob: Record<string, number> = {};
    for (const a of res.assignments) {
      expect(seen.has(a.workerId)).toBe(false);
      seen.add(a.workerId);
      perJob[a.jobId] = (perJob[a.jobId] ?? 0) + 1;
      const w = workers.find((x) => x.id === a.workerId)!;
      const j = jobs.find((x) => x.id === a.jobId)!;
      expect(evaluateMatch(w, credsByWorker[w.id], j, TODAY).eligible).toBe(true);
    }
    for (const j of jobs) expect(perJob[j.id] ?? 0).toBeLessThanOrEqual(j.headcount);
  });

  it("fills at least as many openings as greedy best-score-first", () => {
    for (let seed = 200; seed < 220; seed++) {
      const { workers, credsByWorker, jobs } = board(seed, 60, 20);
      const res = optimizeAssignments({ workers, credsByWorker, jobs, today: TODAY });
      expect(res.stats.filled).toBeGreaterThanOrEqual(res.greedy.filled);
    }
  });

  it("solves 2,000 workers × 200 jobs in well under two seconds", () => {
    const { workers, credsByWorker, jobs } = board(7, 2000, 200);
    const t = Date.now();
    const res = optimizeAssignments({ workers, credsByWorker, jobs, today: TODAY });
    expect(Date.now() - t).toBeLessThan(2000);
    expect(res.stats.filled).toBeGreaterThan(0);
  });

  it("respects openings already filled", () => {
    const { workers, credsByWorker, jobs } = board(3, 30, 5);
    const res = optimizeAssignments({ workers, credsByWorker, jobs, today: TODAY, openings: Object.fromEntries(jobs.map((j) => [j.id, 0])) });
    expect(res.assignments).toHaveLength(0);
  });

  it("produces a valid plan on the demo board", () => {
    const s = seedData();
    const workers = Object.values(s.workers);
    const credsByWorker: Record<string, Credential[]> = {};
    for (const c of Object.values(s.credentials)) (credsByWorker[c.workerId] ??= []).push(c);
    const jobs = Object.values(s.jobs).filter((j) => j.status === "open");
    const today = new Date().toISOString().slice(0, 10);
    const res = optimizeAssignments({ workers, credsByWorker, jobs, today });
    expect(res.stats.filled).toBeGreaterThan(0);
    for (const a of res.assignments) {
      const w = s.workers[a.workerId];
      expect(evaluateMatch(w, credsByWorker[w.id] ?? [], s.jobs[a.jobId], today).eligible).toBe(true);
    }
  });
});
