// Who is using the app.
// Demo mode: a cookie picks the role and the demo worker/employer (no passwords).
// Live mode: Supabase Auth (phone OTP for workers, email OTP for employers and staff). The browser
// signs in with the anon key, then POSTs the access token to /api/auth/session, which stores it
// in an httpOnly cookie. Each request re-validates the token with Supabase.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isDemo } from "./db";
import type { Lang } from "./types";
import { can, isStaffRole, normalizeRole, type Capability, type Role } from "./permissions";

export type { Role } from "./permissions";

export interface Session {
  role: Role;
  workerId: string | null;
  employerId: string | null;
  providerId: string | null;
  userId: string | null;
  /** Who this is, for the activity log: an email, a phone, or a demo label. */
  actor: string;
  /** team_members.id for admins/recruiters who have a row (owners in ADMIN_EMAILS may not). */
  memberId: string | null;
}

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("cp_lang")?.value === "es" ? "es" : "en";
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  if (isDemo()) {
    const role = normalizeRole(c.get("cp_role")?.value);
    if (!role) return null;
    const memberId = role === "admin" ? "founder" : role === "recruiter" ? c.get("cp_member")?.value ?? "tm2" : null;
    let actor = role === "admin" ? "founder (demo)" : `${role} (demo)`;
    if (memberId && role === "recruiter") {
      const { db } = await import("./db");
      const m = await (await db()).table("team_members").get(memberId);
      if (m) actor = m.email;
    }
    return {
      role, memberId, actor, userId: null,
      workerId: c.get("cp_worker")?.value ?? null,
      employerId: c.get("cp_employer")?.value ?? null,
      providerId: c.get("cp_provider")?.value ?? null,
    };
  }
  const token = c.get("cp_token")?.value;
  if (!token) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: user } = await admin.auth.getUser(token);
  if (!user.user) return null;
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.user.id).maybeSingle();
  let role = normalizeRole(profile?.role);
  if (!profile || !role) return null;
  const email = user.user.email ?? null;
  const team = await import("./team");
  let memberId: string | null = null;
  // Access is re-checked on every request, so removing someone (team, employer login, provider) locks them out at once.
  if (isStaffRole(role)) {
    const current = await team.staffRoleFor(email);
    if (!current) return null;
    role = current;
    memberId = role === "admin" ? `founder:${email}` : (await team.memberFor(email))?.id ?? null;
  } else if (role === "employer") {
    const e = await team.employerFor(email);
    if (!e || e.employerId !== profile.employer_id) return null;
  } else if (role === "provider") {
    const p = await team.providerFor(email);
    if (!p || p.id !== profile.provider_id) return null;
  }
  return {
    role, memberId, userId: user.user.id, actor: email ?? user.user.phone ?? user.user.id,
    workerId: profile.worker_id, employerId: profile.employer_id, providerId: profile.provider_id ?? null,
  };
}

/**
 * Gate a page or action by persona. "staff" means admin or recruiter.
 * Admins pass every gate; recruiters also pass employer gates (they post jobs for employers).
 */
export async function requireRole(...roles: (Role | "staff")[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(isDemo() ? "/" : "/login");
  const wanted = roles.flatMap((r) => (r === "staff" ? (["admin", "recruiter"] as Role[]) : [r]));
  const ok = s.role === "admin" || wanted.includes(s.role) || (s.role === "recruiter" && wanted.includes("employer"));
  if (!ok) redirect("/");
  return s;
}

/** Gate by capability (see lib/permissions.ts). */
export async function requireCap(cap: Capability): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(isDemo() ? "/" : "/login");
  if (!can(s.role, cap)) redirect(isStaffRole(s.role) ? "/recruiter" : "/");
  return s;
}

export const isStaff = (s: Session | null | undefined) => isStaffRole(s?.role);

export async function requireWorker(): Promise<Session & { workerId: string }> {
  const s = await requireRole("worker");
  if (!s.workerId) redirect("/onboard");
  return s as Session & { workerId: string };
}

export async function requireEmployer(): Promise<Session & { employerId: string }> {
  const s = await requireRole("employer");
  if (!s.employerId) redirect("/");
  return s as Session & { employerId: string };
}
