// Who can do what. One place, tested in permissions.test.ts.
//
// Personas
//   admin     — the founder only (ADMIN_EMAILS). Runs the business: everything a recruiter can do, plus billing, team, employer
//               accounts, training directory and settings.
//   recruiter — day-to-day matching: pipeline, optimizer, card review, screenings, workers, texts,
//               placements (day-30 check). Can post jobs on an employer's behalf. No billing.
//   employer  — their own company's jobs, shortlists, screening outcomes, hires and invoices.
//   worker    — their own profile, cards, jobs, screenings, training.
//   provider  — a training school: their own class listings, dates and the local demand for them.

export type Role = "worker" | "employer" | "recruiter" | "admin" | "provider";

export type Capability =
  | "recruit" // pipeline, optimizer, review, screenings (operations), workers, texts, placements
  | "postJobForAnyEmployer"
  | "bill" // create invoices, mark paid, screening invoices
  | "manageTeam"
  | "manageEmployers"
  | "manageTraining"
  | "settings"
  | "viewAllCards" // see any worker's card photos
  | "viewAudit"
  | "manageOwnListings" // training providers
  | "payroll"; // run temp payroll, send early pay, manage benefit plans

const CAPS: Record<Role, Capability[]> = {
  admin: ["recruit", "postJobForAnyEmployer", "bill", "manageTeam", "manageEmployers", "manageTraining", "settings", "viewAllCards", "viewAudit", "payroll"],
  recruiter: ["recruit", "postJobForAnyEmployer", "viewAllCards"],
  employer: [],
  worker: [],
  provider: ["manageOwnListings"],
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  return Boolean(role && CAPS[role]?.includes(cap));
}

export const isStaffRole = (role: Role | null | undefined) => role === "admin" || role === "recruiter";

/** Older sessions and profiles used "staff" for everyone on the team; that was the owner, so admin. */
export function normalizeRole(raw: string | null | undefined): Role | null {
  if (raw === "staff") return "admin";
  if (raw === "worker" || raw === "employer" || raw === "recruiter" || raw === "admin" || raw === "provider") return raw;
  return null;
}

export const ROLE_LABEL: Record<Role, string> = { admin: "Founder", recruiter: "Recruiter", employer: "Employer", worker: "Worker", provider: "Training provider" };

/** Where each persona lands after signing in. */
export const HOME: Record<Role, string> = { admin: "/admin", recruiter: "/recruiter", employer: "/employer", worker: "/me", provider: "/provider" };
