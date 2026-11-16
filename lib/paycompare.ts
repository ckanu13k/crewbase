// Pay comparison. Pure functions, tested in newfeatures.test.ts.
// Samples come from jobs posted on CrewPass (midpoint of the pay range, one per job) and from pay that
// workers share anonymously. A figure is shown only with at least `minSamples` samples, so no single
// person's or company's pay can be picked out.

import { zipDistance } from "./geo";

export interface PaySample {
  trade: string;
  zip: string;
  hourly: number;
  source: "job" | "worker";
}

export interface PayStat {
  trade: string;
  n: number;
  jobs: number;
  reports: number;
  median: number;
  p25: number;
  p75: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)) * 100) / 100;
}

/** Reasonable hourly pay only: drops typos like $2 or $900/hr. */
export const plausibleHourly = (n: number) => Number.isFinite(n) && n >= 7.25 && n <= 150;

export function payStats(samples: PaySample[], opts: { minSamples: number; nearZip?: string | null; radiusMiles?: number }): { shown: PayStat[]; hidden: { trade: string; n: number }[] } {
  const near = opts.nearZip;
  const radius = opts.radiusMiles ?? 30;
  const pool = samples.filter((s) => plausibleHourly(s.hourly) && (!near || (zipDistance(near, s.zip) ?? Infinity) <= radius));
  const byTrade: Record<string, PaySample[]> = {};
  for (const s of pool) (byTrade[s.trade] ??= []).push(s);
  const shown: PayStat[] = [];
  const hidden: { trade: string; n: number }[] = [];
  for (const [trade, xs] of Object.entries(byTrade)) {
    if (xs.length < opts.minSamples) {
      hidden.push({ trade, n: xs.length });
      continue;
    }
    const v = xs.map((x) => x.hourly).sort((a, b) => a - b);
    shown.push({ trade, n: xs.length, jobs: xs.filter((x) => x.source === "job").length, reports: xs.filter((x) => x.source === "worker").length, median: quantile(v, 0.5), p25: quantile(v, 0.25), p75: quantile(v, 0.75) });
  }
  return { shown: shown.sort((a, b) => b.median - a.median), hidden };
}
