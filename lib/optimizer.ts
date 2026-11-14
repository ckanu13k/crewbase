// Assignment optimizer: who should be put forward for which job, across ALL open jobs at once.
//
// Ranking candidates job by job lets two jobs fight over the same worker and leaves other workers
// idle. This solves the whole board as one minimum-cost flow:
//
//   source ──(open slots)──▶ job ──(1, cost = −(BIG + score))──▶ worker ──(1)──▶ sink
//
// Only pairs the rules engine marks eligible get an edge (credentials valid on the start date, inside
// the worker's travel radius, shift, NCCER level, experience). Successive shortest paths with
// Dijkstra and Johnson potentials give an exact optimum. BIG is larger than any possible total score,
// so the solver first fills as many openings as possible, then maximizes total match quality.
//
// Complexity: O(F · E log V) where F = openings filled and E = eligible pairs left after exact
// pruning (each job keeps at most `total openings` candidates). The rules engine is O(workers × jobs)
// and runs once. Verified against exhaustive search in optimizer.test.ts.

import { evaluateMatch } from "./matching";
import type { Credential, Job, Worker } from "./types";

export interface Assignment {
  workerId: string;
  jobId: string;
  score: number;
  distanceMiles: number | null;
}

export interface JobSummary {
  jobId: string;
  open: number;
  filled: number;
  eligible: number; // workers who meet every hard requirement
}

export interface OptimizeResult {
  assignments: Assignment[];
  jobs: JobSummary[];
  idleWorkerIds: string[]; // eligible somewhere but not assigned
  unmatchableWorkerIds: string[]; // eligible for no open job
  stats: {
    workers: number;
    jobs: number;
    openings: number;
    eligiblePairs: number;
    filled: number;
    fillRate: number; // filled / min(openings, workers)
    avgScore: number;
    avgMiles: number | null;
    ms: number;
  };
  greedy: { filled: number; totalScore: number }; // baseline: best-score-first, for comparison
}

export interface OptimizeInput {
  workers: Worker[];
  credsByWorker: Record<string, Credential[]>;
  jobs: Job[];
  /** Openings still to fill per job; defaults to job.headcount. */
  openings?: Record<string, number>;
  today: string;
  /** Pairs below this score are never assigned. */
  minScore?: number;
}

interface Edge {
  to: number;
  cap: number;
  cost: number;
  rev: number;
}

class MinCostFlow {
  g: Edge[][];
  constructor(n: number) {
    this.g = Array.from({ length: n }, () => []);
  }
  add(u: number, v: number, cap: number, cost: number) {
    this.g[u].push({ to: v, cap, cost, rev: this.g[v].length });
    this.g[v].push({ to: u, cap: 0, cost: -cost, rev: this.g[u].length - 1 });
  }
  /** Augment one unit at a time while it lowers total cost. Returns units sent. */
  run(s: number, t: number, initialPotential: number[]): number {
    const n = this.g.length;
    const h = initialPotential.slice();
    const dist = new Array<number>(n);
    const prevNode = new Int32Array(n);
    const prevEdge = new Int32Array(n);
    let flow = 0;
    for (;;) {
      dist.fill(Infinity);
      dist[s] = 0;
      const heap = new MinHeap();
      heap.push(0, s);
      while (heap.size) {
        const [d, u] = heap.pop();
        if (d > dist[u]) continue;
        if (u === t) break; // nodes beyond t's distance can keep their old potential
        const edges = this.g[u];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          if (e.cap <= 0) continue;
          const nd = d + e.cost + h[u] - h[e.to];
          if (nd < dist[e.to] - 1e-9) {
            dist[e.to] = nd;
            prevNode[e.to] = u;
            prevEdge[e.to] = i;
            heap.push(nd, e.to);
          }
        }
      }
      if (dist[t] === Infinity) break;
      const dt = dist[t];
      for (let v = 0; v < n; v++) h[v] += Math.min(dist[v], dt);
      const pathCost = h[t] - h[s];
      if (pathCost >= 0) break; // no further improvement
      for (let v = t; v !== s; v = prevNode[v]) {
        const e = this.g[prevNode[v]][prevEdge[v]];
        e.cap -= 1;
        this.g[v][e.rev].cap += 1;
      }
      flow += 1;
    }
    return flow;
  }
}

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p];
      i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k, v = this.v;
    const topK = k[0], topV = v[0];
    const lastK = k.pop()!, lastV = v.pop()!;
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c]; v[i] = v[c];
        i = c;
      }
      k[i] = lastK; v[i] = lastV;
    }
    return [topK, topV];
  }
}

export function optimizeAssignments(input: OptimizeInput): OptimizeResult {
  const t0 = Date.now();
  const { workers, jobs, credsByWorker, today } = input;
  const minScore = input.minScore ?? 0;
  const openings = (j: Job) => Math.max(0, input.openings?.[j.id] ?? j.headcount);

  // 1) Rules engine on every pair; keep eligible ones.
  const pairs: { w: number; j: number; score: number; miles: number | null }[] = [];
  const eligibleByJob = new Array<number>(jobs.length).fill(0);
  const workerEligible = new Array<boolean>(workers.length).fill(false);
  for (let j = 0; j < jobs.length; j++) {
    if (openings(jobs[j]) === 0) continue;
    for (let w = 0; w < workers.length; w++) {
      const r = evaluateMatch(workers[w], credsByWorker[workers[w].id] ?? [], jobs[j], today);
      if (!r.eligible || r.score < minScore) continue;
      pairs.push({ w, j, score: r.score, miles: r.distanceMiles });
      eligibleByJob[j]++;
      workerEligible[w] = true;
    }
  }

  // 2) Split into independent groups (e.g. welders never compete with electricians) and solve each
  //    exactly with min-cost flow. Smaller graphs make every shortest-path search cheaper.
  const J = jobs.length, W = workers.length;
  const totalOpen = jobs.reduce((a, j) => a + openings(j), 0);
  const BIG = 100 * (Math.min(totalOpen, W) + 1) + 1; // > any total score: fill first, then quality
  // Exact pruning: a job never needs more than its top `totalOpen` candidates. If it took someone
  // ranked lower, at least one of its top `totalOpen` would be unassigned everywhere (only
  // totalOpen people get assigned in total), and swapping them in keeps the fill and can't lower
  // the score. On dense boards this removes most edges without changing the answer.
  const byJob = new Map<number, typeof pairs>();
  for (const p of pairs) {
    if (!byJob.has(p.j)) byJob.set(p.j, []);
    byJob.get(p.j)!.push(p);
  }
  const kept: typeof pairs = [];
  for (const list of byJob.values()) {
    if (list.length > totalOpen) list.sort((a, b) => b.score - a.score).length = totalOpen;
    kept.push(...list);
  }

  const parent = Array.from({ length: J + W }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const p of kept) parent[find(p.j)] = find(J + p.w);
  const groups = new Map<number, typeof pairs>();
  for (const p of kept) {
    const g = find(p.j);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(p);
  }

  const assignments: Assignment[] = [];
  for (const gp of groups.values()) {
    const jIdx = [...new Set(gp.map((p) => p.j))];
    const wIdx = [...new Set(gp.map((p) => p.w))];
    const jNode = new Map(jIdx.map((j, i) => [j, 1 + i]));
    const wNode = new Map(wIdx.map((w, i) => [w, 1 + jIdx.length + i]));
    const S = 0, T = 1 + jIdx.length + wIdx.length;
    const mcf = new MinCostFlow(T + 1);
    for (const j of jIdx) mcf.add(S, jNode.get(j)!, openings(jobs[j]), 0);
    const pairEdge: { node: number; idx: number; p: (typeof pairs)[number] }[] = [];
    for (const p of gp) {
      const u = jNode.get(p.j)!;
      pairEdge.push({ node: u, idx: mcf.g[u].length, p });
      mcf.add(u, wNode.get(p.w)!, 1, -(BIG + p.score));
    }
    for (const w of wIdx) mcf.add(wNode.get(w)!, T, 1, 0);

    // Initial potentials = exact shortest distances in this layered DAG (handles negative costs).
    const h = new Array<number>(T + 1).fill(0);
    for (const w of wIdx) h[wNode.get(w)!] = Infinity;
    for (const p of gp) h[wNode.get(p.w)!] = Math.min(h[wNode.get(p.w)!], -(BIG + p.score));
    h[T] = Math.min(0, ...wIdx.map((w) => h[wNode.get(w)!]));
    mcf.run(S, T, h);

    // 3) Read the solution: saturated job→worker edges.
    for (const pe of pairEdge) {
      if (mcf.g[pe.node][pe.idx].cap === 0) {
        assignments.push({ workerId: workers[pe.p.w].id, jobId: jobs[pe.p.j].id, score: pe.p.score, distanceMiles: pe.p.miles });
      }
    }
  }
  assignments.sort((a, b) => a.jobId.localeCompare(b.jobId) || b.score - a.score);

  // Greedy baseline (highest score first) to show what the optimizer adds.
  const gJob = jobs.map(openings);
  const gUsed = new Set<number>();
  let gFilled = 0, gScore = 0;
  for (const p of [...pairs].sort((a, b) => b.score - a.score)) {
    if (gUsed.has(p.w) || gJob[p.j] === 0) continue;
    gUsed.add(p.w); gJob[p.j]--; gFilled++; gScore += p.score;
  }

  const assigned = new Set(assignments.map((a) => a.workerId));
  const filledByJob: Record<string, number> = {};
  for (const a of assignments) filledByJob[a.jobId] = (filledByJob[a.jobId] ?? 0) + 1;
  const miles = assignments.map((a) => a.distanceMiles).filter((m): m is number => m !== null);
  const filled = assignments.length;

  return {
    assignments,
    jobs: jobs.map((j, i) => ({ jobId: j.id, open: openings(j), filled: filledByJob[j.id] ?? 0, eligible: eligibleByJob[i] })),
    idleWorkerIds: workers.filter((w, i) => workerEligible[i] && !assigned.has(w.id)).map((w) => w.id),
    unmatchableWorkerIds: workers.filter((_, i) => !workerEligible[i]).map((w) => w.id),
    stats: {
      workers: W,
      jobs: jobs.filter((j) => openings(j) > 0).length,
      openings: totalOpen,
      eligiblePairs: pairs.length,
      filled,
      fillRate: Math.min(totalOpen, W) ? filled / Math.min(totalOpen, W) : 0,
      avgScore: filled ? Math.round((assignments.reduce((a, x) => a + x.score, 0) / filled) * 10) / 10 : 0,
      avgMiles: miles.length ? Math.round((miles.reduce((a, b) => a + b, 0) / miles.length) * 10) / 10 : null,
      ms: Date.now() - t0,
    },
    greedy: { filled: gFilled, totalScore: gScore },
  };
}
