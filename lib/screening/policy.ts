// Background-check and drug-screen rules. Pure functions (tested in policy.test.ts).
//
// Design choices:
// - Only outcome + dates are stored. Reports never leave the provider.
// - A result is reused only for the SAME employer: a report is obtained for one employer's hiring
//   decision, so it isn't passed to another company.
// - Ordering happens late (when the employer wants to hire), never at signup.
// - Turning someone down because of a result follows the FCRA steps: pre-adverse notice with a copy
//   of the report and the Summary of Rights, a waiting period, then a final notice.

import type { Job, Lang, Screening, ScreeningKind, ScreeningStatus } from "../types";

/** How long a clear result counts for the same employer. Estimates; employers often set their own. */
export const VALID_DAYS: Record<ScreeningKind, number> = { background: 365, drug: 30 };

/** Default price billed to the employer (provider cost + handling). Estimates; editable per order. */
export const DEFAULT_PRICE: Record<ScreeningKind, number> = { background: 65, drug: 75 };

/** Business days between the pre-adverse and final notice. 5 is common practice, not a statute. */
export const ADVERSE_WAIT_BUSINESS_DAYS = 5;

export const FCRA_RIGHTS_URL = "https://www.consumerfinance.gov/learnmore";

export const KIND_LABEL: Record<ScreeningKind, Record<Lang, string>> = {
  background: { en: "Background check", es: "Revisión de antecedentes" },
  drug: { en: "Drug screen", es: "Prueba de drogas" },
};

export function requiredKinds(job: Pick<Job, "requiresBackground" | "requiresDrug">): ScreeningKind[] {
  return [...(job.requiresBackground ? ["background" as const] : []), ...(job.requiresDrug ? ["drug" as const] : [])];
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Mon–Fri days strictly after `from` up to and including `to`. */
export function businessDaysBetween(from: string, to: string): number {
  let n = 0;
  const d = new Date(from.slice(0, 10) + "T00:00:00Z");
  const end = new Date(to.slice(0, 10) + "T00:00:00Z");
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

const OPEN: ScreeningStatus[] = ["awaiting_consent", "in_progress", "needs_review", "pre_adverse"];
export const isOpen = (s: Pick<Screening, "status">) => OPEN.includes(s.status);

/** A clear result for this employer that is still valid on `asOf` (the job's start date, or today). */
export function isCurrentClear(s: Screening, employerId: string, asOf: string): boolean {
  return s.employerId === employerId && s.status === "clear" && (!s.expiresOn || s.expiresOn >= asOf.slice(0, 10));
}

export interface GateResult {
  ok: boolean;
  /** Per required kind: what's on file for this employer. */
  items: { kind: ScreeningKind; state: "clear" | "pending" | "review" | "not_cleared" | "missing"; screening: Screening | null }[];
}

/** Can this worker be marked hired for this job? Every required kind needs a current clear result. */
export function hireGate(job: Job, screenings: Screening[], today: string): GateResult {
  const asOf = job.startDate > today ? job.startDate : today;
  const items = requiredKinds(job).map((kind) => {
    const mine = screenings
      .filter((s) => s.kind === kind && s.employerId === job.employerId && s.status !== "canceled")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const clear = mine.find((s) => isCurrentClear(s, job.employerId, asOf));
    if (clear) return { kind, state: "clear" as const, screening: clear };
    const latest = mine[0] ?? null;
    if (!latest) return { kind, state: "missing" as const, screening: null };
    if (latest.status === "awaiting_consent" || latest.status === "in_progress") return { kind, state: "pending" as const, screening: latest };
    if (latest.status === "needs_review" || latest.status === "pre_adverse") return { kind, state: "review" as const, screening: latest };
    if (latest.status === "not_cleared") return { kind, state: "not_cleared" as const, screening: latest };
    return { kind, state: "missing" as const, screening: latest }; // an expired clear
  });
  return { ok: items.every((i) => i.state === "clear"), items };
}

/** Kinds that still need ordering for this job (nothing current or in flight for this employer). */
export function kindsToOrder(job: Job, screenings: Screening[], today: string): ScreeningKind[] {
  return hireGate(job, screenings, today).items.filter((i) => i.state === "missing").map((i) => i.kind);
}

/** The final adverse-action notice may go out once the waiting period after the pre-adverse notice has passed. */
export function canSendFinalNotice(s: Screening, today: string, waitDays = ADVERSE_WAIT_BUSINESS_DAYS): boolean {
  return s.status === "pre_adverse" && Boolean(s.preAdverseAt) && s.reportCopySent && businessDaysBetween(s.preAdverseAt!, today) >= waitDays;
}

/** What employers see: outcome only. */
export function employerLabel(s: Pick<Screening, "status" | "completedAt">): string {
  switch (s.status) {
    case "clear": return `Clear${s.completedAt ? ` · ${s.completedAt.slice(0, 10)}` : ""}`;
    case "awaiting_consent": return "Waiting on worker's authorization";
    case "in_progress": return "In progress";
    case "needs_review":
    case "pre_adverse": return "Under review";
    case "not_cleared": return "Not cleared";
    case "canceled": return "Canceled";
  }
}

/** What the worker sees about their own screening. */
export function workerLabel(s: Pick<Screening, "status" | "completedAt">, lang: Lang): string {
  const es = lang === "es";
  switch (s.status) {
    case "clear": return es ? "Aprobada" : "Clear";
    case "awaiting_consent": return es ? "Necesita tu autorización" : "Needs your authorization";
    case "in_progress": return es ? "En proceso" : "In progress";
    case "needs_review": return es ? "En revisión" : "Being reviewed";
    case "pre_adverse": return es ? "Aviso enviado: revisa tus derechos" : "Notice sent: see your rights";
    case "not_cleared": return es ? "No aprobada para este trabajo" : "Not cleared for this job";
    case "canceled": return es ? "Cancelada" : "Canceled";
  }
}

/** Screenings that can be billed: ordered with the provider and not yet invoiced. */
export function billable(screenings: Screening[]): Screening[] {
  return screenings.filter((s) => s.orderedAt && !s.invoiceId && s.priceUsd > 0);
}
