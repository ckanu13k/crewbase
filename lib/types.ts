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
  radiusMiles: number; // 0 = any distance
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
  startDate: string; // YYYY-MM-DD
  headcount: number;
  placementFee: number; // $ per hire
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
  nextStart: string | null;
  weeks: number | null;
  clockHours: number | null;
  costUsd: number | null;
  funding: Funding[];
  languages: Lang[];
  url: string | null;
  sample: boolean; // true = demo data, not a real program
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
  channel: "sms" | "whatsapp";
  status: "sent" | "simulated" | "failed";
  providerId: string | null;
  createdAt: string;
}
