// Links "what you're missing" gaps to training programs, and words gaps in plain EN/ES.

import { credLabel, skillLabel, tradeLabel } from "./taxonomy";
import type { Funding, Job, Lang, TrainingProgram } from "./types";
import { distanceMiles, type Point } from "./geo";
import { trainableGaps, type Gap } from "./matching";

export const FUNDING_LABEL: Record<Funding, Record<Lang, string>> = {
  wioa: { en: "WIOA (workforce board)", es: "WIOA (junta laboral)" },
  workforce_pell: { en: "Workforce Pell grant", es: "Beca Workforce Pell" },
  sdf: { en: "Employer-sponsored (Skills Development Fund)", es: "Pagado por empleador (Skills Development Fund)" },
  employer: { en: "Employer pays", es: "Lo paga el empleador" },
  apprenticeship: { en: "Paid apprenticeship", es: "Aprendizaje pagado" },
  self: { en: "Self-pay", es: "Pago propio" },
};

export function programCovers(p: TrainingProgram, gap: Gap): boolean {
  if (gap.credential) return p.coversCredentials.includes(gap.credential);
  if (gap.skill) return p.coversSkills.includes(gap.skill);
  if (gap.kind === "nccer_level") return p.nccerLevel !== null && p.nccerLevel >= Number(gap.need ?? 0);
  return false;
}

/** Soonest upcoming start first; programs with no listed start go last. */
export function sortPrograms(ps: TrainingProgram[], today: string): TrainingProgram[] {
  const key = (p: TrainingProgram) => (p.nextStart && p.nextStart >= today ? p.nextStart : "9999-12-31");
  return [...ps].sort((a, b) => key(a).localeCompare(key(b)) || (a.costUsd ?? 1e9) - (b.costUsd ?? 1e9));
}

export interface GapWithPrograms {
  gap: Gap;
  programs: TrainingProgram[];
}

export function programsForGaps(gaps: Gap[], programs: TrainingProgram[], today: string, perGap = 3): GapWithPrograms[] {
  return trainableGaps(gaps).map((gap) => ({
    gap,
    programs: sortPrograms(programs.filter((p) => p.status !== "pending" && programCovers(p, gap)), today).slice(0, perGap),
  }));
}

/** Rule-based wording. Used directly when no AI key is set, and as the facts the AI rewrites. */
export function gapText(g: Gap, lang: Lang): string {
  const es = lang === "es";
  const cred = g.credential ? credLabel(g.credential, lang) : "";
  const skill = g.skill ? skillLabel(g.skill, lang) : "";
  switch (g.kind) {
    case "credential_missing":
      return es ? `Necesitas: ${cred}.` : `You need: ${cred}.`;
    case "credential_expired":
      return es ? `Tu ${cred} vence (${g.have}) antes de que empiece el trabajo. Renuévala.` : `Your ${cred} expires (${g.have}) before the job starts. Renew it.`;
    case "credential_expires_soon":
      return es ? `Tu ${cred} vence pronto (${g.have}).` : `Your ${cred} expires soon (${g.have}).`;
    case "credential_unverified":
      return es ? `Sube una foto de tu ${cred} para que la verifiquemos.` : `Upload a photo of your ${cred} so we can verify it.`;
    case "preferred_credential_missing":
      return es ? `Ayuda tener: ${cred} (no es obligatorio).` : `Nice to have: ${cred} (not required).`;
    case "skill_missing":
      return es ? `El trabajo pide: ${skill}.` : `The job asks for: ${skill}.`;
    case "nccer_level":
      return es ? `Piden nivel NCCER ${g.need}; ${g.have ? `tú tienes nivel ${g.have}` : "no tienes nivel NCCER registrado"}.` : `Needs NCCER level ${g.need}; you have ${g.have ? `level ${g.have}` : "none on file"}.`;
    case "experience":
      return es ? `Piden ${g.need} años de experiencia; tú tienes ${g.have}.` : `Needs ${g.need} years of experience; you have ${g.have}.`;
    case "distance":
      return es ? `Está a ${g.have} millas; tu límite es ${g.need}.` : `It's ${g.have} miles away; your limit is ${g.need}.`;
    case "shift":
      return es ? `Es turno de ${shiftLabel(String(g.need), lang)}, que no marcaste.` : `It's a ${shiftLabel(String(g.need), lang)} shift, which you didn't pick.`;
    case "trade":
      return es ? `Es para ${tradeLabel(String(g.need), lang)}; tu oficio es ${tradeLabel(String(g.have ?? ""), lang)}.` : `It's a ${tradeLabel(String(g.need), lang)} job; your trade is ${tradeLabel(String(g.have ?? ""), lang)}.`;
  }
}

export function shiftLabel(s: string, lang: Lang): string {
  const m: Record<string, Record<Lang, string>> = {
    day: { en: "day", es: "día" },
    night: { en: "night", es: "noche" },
    rotating: { en: "rotating", es: "rotativo" },
    turnaround: { en: "turnaround", es: "paro de planta" },
  };
  return m[s]?.[lang] ?? s;
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------------------------
// Location-aware "top trainings": rank programs by how many open job openings near the user they
// help unlock, then by distance and how soon they start. Because this reads the live job board,
// the ranking changes on its own when employers change what they require.

export interface RankedProgram {
  program: TrainingProgram;
  miles: number | null;
  /** Open positions within the search radius that ask for something this program gives. */
  openingsUnlocked: number;
  jobsUnlocked: string[];
  /** For a signed-in worker: blocking gaps on nearby jobs this program would close. */
  closesMyGaps: number;
  /** Inside the search radius (or location unknown). Farther programs are listed after, still useful. */
  inRange: boolean;
}

/** Does this program supply something the job asks for (a required or preferred card, the NCCER level, or at least half its skills)? */
export function programServesJob(p: TrainingProgram, job: Job): boolean {
  if (p.trade && p.trade !== job.trade && ![...job.requiredCredentials, ...job.preferredCredentials].some((c) => p.coversCredentials.includes(c))) return false;
  const gives = (c: string) => p.coversCredentials.includes(c) || (c === "osha10" && p.coversCredentials.includes("osha30"));
  if (job.requiredCredentials.some(gives) || job.preferredCredentials.some(gives)) return true;
  if (job.minNccerLevel > 0 && p.nccerLevel !== null && p.trade === job.trade && p.nccerLevel >= job.minNccerLevel) return true;
  const skillHits = job.requiredSkills.filter((s) => p.coversSkills.includes(s)).length;
  return job.requiredSkills.length > 0 && skillHits * 2 >= job.requiredSkills.length;
}

export function rankTrainingNear(opts: {
  programs: TrainingProgram[];
  jobs: Job[];
  from: Point | null;
  radiusMiles: number; // jobs and programs farther than this are ignored (0 = anywhere)
  today: string;
  myGaps?: Gap[]; // blocking gaps from nearby jobs, for a signed-in worker
}): RankedProgram[] {
  const { programs, jobs, from, radiusMiles, today } = opts;
  const within = (m: number | null) => radiusMiles === 0 || m === null || m <= radiusMiles;
  const nearbyJobs = jobs.filter((j) => j.status === "open" && within(from ? distanceMiles({ lat: from[0], lng: from[1] }, j) : null));
  const gaps = trainableGaps(opts.myGaps ?? []);

  const ranked = programs.map((program) => {
    const miles = from ? distanceMiles({ lat: from[0], lng: from[1] }, program) : null;
    const served = nearbyJobs.filter((j) => programServesJob(program, j));
    return {
      program,
      miles: miles === null ? null : Math.round(miles * 10) / 10,
      openingsUnlocked: served.reduce((a, j) => a + j.headcount, 0),
      jobsUnlocked: served.map((j) => j.id),
      closesMyGaps: gaps.filter((g) => programCovers(program, g)).length,
      inRange: within(miles),
    };
  });
  const startKey = (p: TrainingProgram) => (p.nextStart && p.nextStart >= today ? p.nextStart : "9999-12-31");
  return ranked
    .filter((r) => r.inRange || r.closesMyGaps > 0 || r.openingsUnlocked > 0)
    .sort(
      (a, b) =>
        b.closesMyGaps - a.closesMyGaps ||
        Number(b.inRange) - Number(a.inRange) ||
        b.openingsUnlocked - a.openingsUnlocked ||
        (a.miles ?? 999) - (b.miles ?? 999) ||
        startKey(a.program).localeCompare(startKey(b.program)),
    );
}

/** Programs whose requirement notes haven't been checked in this many days get flagged for staff. */
export const REVIEW_EVERY_DAYS = 90;
export function needsReview(p: TrainingProgram, today: string, everyDays = REVIEW_EVERY_DAYS): boolean {
  if (!p.reviewedOn) return true;
  return (Date.parse(today) - Date.parse(p.reviewedOn)) / 86_400_000 > everyDays;
}
