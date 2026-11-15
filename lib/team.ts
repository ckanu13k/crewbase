import "server-only";
import { db } from "./db";
import type { Role } from "./permissions";

/** Owner emails from the environment. STAFF_EMAILS is the older name; both mean admin. */
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
  return member?.role ?? null;
}
