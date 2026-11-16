import "server-only";
import { db } from "./db";
import type { Role } from "./permissions";

/** Founder emails from the environment — the ONLY way to be an admin. STAFF_EMAILS is the older name. */
export function envAdmins(): string[] {
  return [process.env.ADMIN_EMAILS, process.env.STAFF_EMAILS]
    .flatMap((v) => (v ?? "").split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Staff role for an email right now, or null if they're not on the team. */
export async function staffRoleFor(email: string | null | undefined): Promise<Extract<Role, "admin" | "recruiter"> | null> {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  if (envAdmins().includes(e)) return "admin";
  const member = (await (await db()).table("team_members").list()).find((m) => m.email.trim().toLowerCase() === e);
  // Team members are recruiters, whatever an older row says. Admin is founder-only.
  return member ? "recruiter" : null;
}

/** The team_members row for an email, if any (owners in ADMIN_EMAILS may not have one). */
export async function memberFor(email: string | null | undefined) {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  return (await (await db()).table("team_members").list()).find((m) => m.email.trim().toLowerCase() === e) ?? null;
}

/** Which employer an email may sign in for: the company contact (owner) or an added hiring manager. */
export async function employerFor(email: string | null | undefined): Promise<{ employerId: string; role: "owner" | "hiring_manager" } | null> {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  const store = await db();
  const owner = (await store.table("employers").list()).find((x) => x.email.trim().toLowerCase() === e);
  if (owner) return { employerId: owner.id, role: "owner" };
  const u = (await store.table("employer_users").list()).find((x) => x.email.trim().toLowerCase() === e);
  return u ? { employerId: u.employerId, role: u.role } : null;
}

/** Training provider account for an email. */
export async function providerFor(email: string | null | undefined) {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  return (await (await db()).table("providers").list()).find((p) => p.contactEmail.trim().toLowerCase() === e) ?? null;
}
