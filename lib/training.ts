// Links "what you're missing" gaps to training programs, and words gaps in plain EN/ES.

import { credLabel, skillLabel, tradeLabel } from "./taxonomy";
import type { Funding, Lang, TrainingProgram } from "./types";
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
    programs: sortPrograms(programs.filter((p) => programCovers(p, gap)), today).slice(0, perGap),
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
