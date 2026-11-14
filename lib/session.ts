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

export type Role = "worker" | "employer" | "staff";

export interface Session {
  role: Role;
  workerId: string | null;
  employerId: string | null;
  userId: string | null;
}

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("cp_lang")?.value === "es" ? "es" : "en";
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  if (isDemo()) {
    const role = c.get("cp_role")?.value as Role | undefined;
    if (!role) return null;
    return { role, workerId: c.get("cp_worker")?.value ?? null, employerId: c.get("cp_employer")?.value ?? null, userId: null };
  }
  const token = c.get("cp_token")?.value;
  if (!token) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: user } = await admin.auth.getUser(token);
  if (!user.user) return null;
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.user.id).maybeSingle();
  if (!profile) return null;
  return { role: profile.role, workerId: profile.worker_id, employerId: profile.employer_id, userId: user.user.id };
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(isDemo() ? "/" : "/login");
  // Staff can see every screen.
  if (!roles.includes(s.role) && s.role !== "staff") redirect("/");
  return s;
}

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
