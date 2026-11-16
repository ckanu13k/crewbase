// Core domain types shared by the matching engine, data layer and UI.

export type Lang = "en" | "es";
export type Shift = "day" | "night" | "rotating" | "turnaround";
export type Channel = "web" | "sms" | "whatsapp" | "voice";
/** Where the work is. Industrial = refineries, chemical plants and fab shops. */
export type Sector = "industrial" | "construction" | "warehouse" | "residential";
/** Direct hire (employer's payroll, one placement fee) or temp (CrewPass is the employer of record and bills hourly). */
export type HireType = "direct" | "temp";
export type PayoutSpeed = "weekly" | "next_day" | "instant";

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
  /** Temp work: how fast approved hours are paid out (free for workers), and payroll onboarding (W-4, I-9, deposit) with the payroll partner. */
  payoutSpeed?: PayoutSpeed;
  payrollStatus?: "not_started" | "invited" | "ready";
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
  sector?: Sector | null;
  /** Outgoing webhook to the employer's applicant-tracking system (https only). The secret signs each delivery. */
  atsWebhookUrl?: string | null;
  atsWebhookSecret?: string | null;
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
  sector?: Sector;
  hireType?: HireType;
  /** Temp only: per diem paid for each day worked, the planned last day, and the employer's PO / work-order number. */
  perDiem?: number | null;
  endDate?: string | null;
  workOrder?: string | null;
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

// ---------------- Temp crews: assignments, timesheets, payroll ----------------

export interface Assignment {
  id: string;
  jobId: string;
  workerId: string;
  employerId: string;
  matchId: string | null;
  startDate: string;
  endDate: string | null;
  payRate: number; // $/hr to the worker
  billRate: number; // $/hr billed to the employer
  perDiem: number; // $ per day worked (0 = none)
  workOrder: string | null;
  status: "active" | "ended" | "canceled";
  endedReason: string | null;
  createdAt: string;
}

export type Attendance = "worked" | "late" | "no_show" | "called_off";

export interface Timesheet {
  id: string;
  assignmentId: string;
  workerId: string;
  employerId: string;
  jobId: string;
  date: string; // the day the shift started
  clockIn: string | null; // HH:MM, local time
  clockOut: string | null;
  breakMinutes: number;
  hours: number;
  attendance: Attendance;
  perDiem: boolean;
  status: "open" | "submitted" | "approved" | "disputed";
  note: string;
  approvedBy: string | null;
  approvedAt: string | null;
  payRunId: string | null;
  payoutId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayLine {
  workerId: string;
  hours: number;
  regHours: number;
  otHours: number;
  straightPay: number;
  otPremium: number;
  gross: number;
  perDiem: number;
  paidEarly: number; // gross already sent as next-day / instant pay
  balance: number; // gross still due on payday
}

export interface PayInvoice {
  employerId: string;
  regHours: number;
  otHours: number;
  labor: number;
  perDiem: number;
  total: number;
  invoiceId: string | null;
  invoiceUrl: string | null;
}

export interface PayRun {
  id: string;
  periodStart: string; // Monday
  periodEnd: string; // Sunday
  status: "draft" | "approved" | "paid";
  lines: PayLine[];
  invoices: PayInvoice[];
  timesheetIds: string[];
  createdBy: string;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface Payout {
  id: string;
  workerId: string;
  timesheetId: string;
  amount: number; // gross; the payroll partner withholds taxes
  speed: "next_day" | "instant";
  status: "pending" | "sent" | "failed";
  providerRef: string | null;
  createdAt: string;
  sentAt: string | null;
}

// ---------------- Ratings and crews ----------------

export interface Rating {
  id: string;
  workerId: string;
  employerId: string;
  jobId: string;
  assignmentId: string | null;
  placementId: string | null;
  quality: number; // 1-5
  safety: number; // 1-5
  rehire: boolean;
  comment: string; // seen by the employer and our team, not the worker
  by: string;
  createdAt: string;
}

export interface CrewMember {
  id: string;
  employerId: string;
  workerId: string;
  note: string;
  addedBy: string;
  createdAt: string;
}

// ---------------- Skills assessments ----------------

export interface AssessmentAttempt {
  id: string;
  workerId: string;
  assessmentId: string;
  kind: "knowledge" | "hands_on";
  questionIds: string[];
  answers: number[] | null;
  startedAt: string;
  completedAt: string | null;
  score: number | null; // 0-100
  passed: boolean | null;
  proctored: boolean;
  assessor: string | null; // hands-on: who watched the worker do it
  note: string | null;
}

// ---------------- Benefits ----------------

export type BenefitKind = "workers_comp" | "occupational_accident" | "health" | "dental_vision" | "paid_time_off" | "retirement" | "other";

export interface BenefitPlan {
  id: string;
  kind: BenefitKind;
  name: string;
  carrier: string;
  status: "active" | "planned";
  eligibility: string;
  workerCost: string;
  url: string | null;
  createdAt: string;
}

// ---------------- Interviews ----------------

export interface Interview {
  id: string;
  matchId: string;
  jobId: string;
  workerId: string;
  employerId: string;
  slots: string[]; // "YYYY-MM-DDTHH:MM", America/Chicago
  chosenSlot: string | null;
  mode: "in_person" | "phone" | "video";
  location: string;
  status: "proposed" | "booked" | "canceled";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------- Pay comparison ----------------

export interface PayReport {
  id: string;
  workerId: string | null;
  trade: string;
  zip: string;
  hourly: number;
  createdAt: string;
}
