// Data access. Two interchangeable stores behind one interface:
//   - memory  : seeded demo data, persisted to .data/demo.json (used when Supabase env vars are absent)
//   - supabase: Postgres tables from supabase/migrations, accessed server-side with the service role key
// Every table row is a camelCase object here and snake_case in Postgres.

import "server-only";
import type {
  Credential, Employer, Job, Match, OnboardingSession, OutboxMessage, Placement, Screening, TrainingProgram, Worker,
} from "../types";

export interface Rows {
  workers: Worker;
  credentials: Credential;
  employers: Employer;
  jobs: Job;
  matches: Match;
  placements: Placement;
  training_programs: TrainingProgram;
  onboarding_sessions: OnboardingSession;
  outbox: OutboxMessage;
  screenings: Screening;
}
export type TableName = keyof Rows;

export interface Table<T extends { id: string }> {
  list(where?: Partial<T>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  upsert(row: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface Store {
  kind: "memory" | "supabase";
  table<N extends TableName>(name: N): Table<Rows[N]>;
  saveFile(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
  readFile(path: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

export const isDemo = () => !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let store: Store | null = null;

export async function db(): Promise<Store> {
  if (store) return store;
  if (isDemo()) {
    const { createMemoryStore } = await import("./memory");
    store = await createMemoryStore();
  } else {
    const { createSupabaseStore } = await import("./supabase");
    store = createSupabaseStore();
  }
  return store;
}

export const newId = () => crypto.randomUUID();
export const nowISO = () => new Date().toISOString();
export const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
