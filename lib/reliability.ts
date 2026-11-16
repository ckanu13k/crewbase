// Reliability and ratings. Pure functions, tested in newfeatures.test.ts.
//
// Reliability comes from what actually happened on approved or disputed timesheets, not opinions:
//   on time = 1, late = 0.7, called off ahead of the shift = 0.5, no-show = 0.
// It is shown only after MIN_SHIFTS shifts so one bad day doesn't define a new worker.
// Ratings (quality, safety, rehire) come from employers after a job; workers see their averages,
// never individual comments.

import type { Rating, Timesheet } from "./types";

export const MIN_SHIFTS = 3;
const POINTS = { worked: 1, late: 0.7, called_off: 0.5, no_show: 0 } as const;

export interface Reliability {
  score: number | null; // 0-100, null until MIN_SHIFTS
  shifts: number;
  late: number;
  noShows: number;
  calledOff: number;
  ratings: number;
  quality: number | null; // average 1-5
  safety: number | null;
  rehirePct: number | null;
  label: "new" | "excellent" | "good" | "fair" | "poor";
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function reliability(timesheets: Pick<Timesheet, "attendance" | "status">[], ratings: Pick<Rating, "quality" | "safety" | "rehire">[]): Reliability {
  const counted = timesheets.filter((t) => t.status === "approved" || t.status === "disputed");
  const shifts = counted.length;
  const score = shifts >= MIN_SHIFTS ? Math.round((100 * counted.reduce((s, t) => s + POINTS[t.attendance], 0)) / shifts) : null;
  const rehires = ratings.filter((r) => r.rehire).length;
  const label: Reliability["label"] = score === null ? "new" : score >= 95 ? "excellent" : score >= 85 ? "good" : score >= 70 ? "fair" : "poor";
  return {
    score, shifts, label,
    late: counted.filter((t) => t.attendance === "late").length,
    noShows: counted.filter((t) => t.attendance === "no_show").length,
    calledOff: counted.filter((t) => t.attendance === "called_off").length,
    ratings: ratings.length,
    quality: avg(ratings.map((r) => r.quality)),
    safety: avg(ratings.map((r) => r.safety)),
    rehirePct: ratings.length ? Math.round((100 * rehires) / ratings.length) : null,
  };
}

export function reliabilityText(r: Reliability, es = false): string {
  if (r.score === null) return es ? `Nuevo (${r.shifts} turnos)` : `New (${r.shifts} shift${r.shifts === 1 ? "" : "s"})`;
  return es ? `Confiabilidad ${r.score} · ${r.shifts} turnos` : `Reliability ${r.score} · ${r.shifts} shifts`;
}

/** Clamp a 1-5 form value. */
export const stars = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v) || 0)));
