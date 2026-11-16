// Core domain types shared by the matching engine, data layer and UI.

export type Lang = "en" | "es";
export type Shift = "day" | "night" | "rotating" | "turnaround";
export type Channel = "web" | "sms" | "whatsapp" | "voice";

/** How much we trust a credential. Drives the badge shown to employers. */
export type Verification = "self" | "document" | "verified";

export interface Worker {
  id: string;
  phone: string; // E.164
  name: string;
  lang: Lang;
  zip: string | null;
  lat?: number | null; // from the device's location, if the worker shared it
  lng?: number | null;
  radiusMiles: number; // 0 = any distance
  email?: string | null; // optional; lets a worker sign in and get alerts by email
  alerts?: "sms" | "email" | "none";
  lastSeenAt?: string | null;
  shifts: Shift[];
  trade: string | null; // TradeId
  yearsExperience: number | null;
  nccerLevel: number; // 0 = none, 1-4 = NCCER craft level completed
  skills: string[]; // SkillId[]
  summary: string; // short bio, worker-confirmed
  consentSms: boolean;
  onboardingComplete: boolean;
  createdAt: string;
}

export interface Credential {
  id: string;
  workerId: string;
  type: string; // CredentialTypeId
  number: string | null;
  holderName: string | null;
  issuedOn: string | null; // YYYY-MM-DD
  expiresOn: string | null; // YYYY-MM-DD
  photoPath: string | null;
  verification: Verification;
  verifiedBy: string | null;
  verifiedMethod: string | null; // e.g. "NCCER registry lookup", "TDLR license search"
  extractionConfidence: number | null; // 0-1 from AI extraction
  needsReview: boolean;
  createdAt: string;
}

export interface Employer {
  recruiterId?: string | null; // team member who owns this account
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  zip: string;
  createdAt: string;
}

export type JobStatus = "open" | "filled" | "closed";

export interface Job {
  id: string;
  employerId: string;
  title: string;
  trade: string; // TradeId
  requiredCredentials: string[];
  preferredCredentials: string[];
  requiredSkills: string[];
  minNccerLevel: number;
  minYears: number;
  payMin: number; // $/hr
  payMax: number;
  shift: Shift;
  zip: string;
  lat?: number | null; // exact site, if known; otherwise the ZIP centroid is used
  lng?: number | null;
  startDate: string; // YYYY-MM-DD
  headcount: number;
  placementFee: number; // $ per hire
  /** Hiring steps the employer requires before day one. */
  requiresBackground?: boolean;
  requiresDrug?: boolean;
  status: JobStatus;
  description: string;
  createdAt: string;
}

export type MatchStage = "shortlisted" | "sent" | "interview" | "hired" | "rejected";

export interface Match {
  id: string;
  jobId: string;
  workerId: string;
  stage: MatchStage;
  score: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PlacementStatus =
  | "active" // started, waiting for day 30
  | "day30_confirmed"
  | "invoiced"
  | "paid"
  | "left_early" // left before day 90: free replacement owed
  | "replaced";

export interface Placement {
  id: string;
  matchId: string;
  jobId: string;
  workerId: string;
  employerId: string;
  startDate: string;
  day30Date: string;
  guaranteeEndsOn: string; // start + 90 days
  fee: number;
  status: PlacementStatus;
  invoiceId: string | null;
  invoiceUrl: string | null;
  createdAt: string;
}

export type Funding = "wioa" | "workforce_pell" | "sdf" | "employer" | "apprenticeship" | "self";

export interface TrainingProgram {
  id: string;
  provider: string;
  name: string;
  trade: string | null;
  coversCredentials: string[];
  coversSkills: string[];
  nccerLevel: number | null; // level this program completes
  city: string;
  zip: string;
  lat?: number | null;
  lng?: number | null;
  nextStart: string | null;
  weeks: number | null;
  clockHours: number | null;
  costUsd: number | null;
  funding: Funding[];
  languages: Lang[];
  url: string | null;
  sample: boolean; // true = demo data, not a real program
  /** What employers currently ask for, in plain words. Staff update this when requirements change. */
  requirementNote?: string | null;
  /** Date staff last checked the requirements and dates against the provider and local employers. */
  reviewedOn?: string | null;
  providerId?: string | null; // set when a training provider manages this listing
  status?: "published" | "pending"; // provider-added listings wait for admin approval
}

export interface OnboardingSession {
  id: string;
  channel: Channel;
  address: string; // phone number or web session key
  workerId: string | null;
  step: string;
  lang: Lang;
  answers: Record<string, unknown>;
  updatedAt: string;
}

export interface OutboxMessage {
  id: string;
  to: string;
  body: string;
  channel: "sms" | "whatsapp" | "email";
  status: "sent" | "simulated" | "failed";
  providerId: string | null;
  createdAt: string;
}

// ---------------- Background checks and drug screens ----------------
// Only the outcome and dates are stored here. The report itself stays with the screening provider.

export type ScreeningKind = "background" | "drug";
export type ScreeningProvider = "manual" | "checkr";
export type ScreeningStatus =
  | "awaiting_consent" // requested; the worker hasn't authorized it yet
  | "in_progress" // authorized and ordered with the provider
  | "clear" // no issues, or cleared after an individual review
  | "needs_review" // provider flagged something; staff must review before any decision
  | "pre_adverse" // pre-adverse action notice sent; waiting period running
  | "not_cleared" // final adverse action notice sent
  | "canceled";

export interface Screening {
  id: string;
  workerId: string;
  employerId: string;
  jobId: string;
  matchId: string | null;
  kind: ScreeningKind;
  provider: ScreeningProvider;
  providerRef: string | null; // e.g. Checkr candidate id
  consentUrl: string | null; // provider-hosted authorization page, if any
  status: ScreeningStatus;
  consentAt: string | null;
  consentName: string | null; // typed signature
  orderedAt: string | null;
  completedAt: string | null; // date the result came back
  expiresOn: string | null; // a clear result counts until this date
  reviewedNote: string | null; // staff note on an individual review (no report details)
  preAdverseAt: string | null;
  reportCopySent: boolean;
  finalAdverseAt: string | null;
  priceUsd: number; // billed to the employer
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Recruiters. Admin is founder-only (ADMIN_EMAILS / STAFF_EMAILS), never a team row. */
export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: "recruiter";
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorRole: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
}

export interface AppSetting {
  id: string; // the setting key
  value: unknown;
  updatedAt: string;
  updatedBy: string;
}

export interface Task {
  id: string;
  ownerId: string;
  title: string;
  dueOn: string | null;
  link: string | null;
  done: boolean;
  createdAt: string;
}

export interface EmployerUser {
  id: string;
  employerId: string;
  email: string;
  name: string;
  role: "owner" | "hiring_manager";
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  contactEmail: string;
  website: string | null;
  createdAt: string;
}
