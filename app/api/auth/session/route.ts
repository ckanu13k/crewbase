// Live mode: the browser signs in with Supabase Auth (OTP) and hands us the access token.
// We verify it, make sure a profile exists, and store the token in an httpOnly cookie.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db, isDemo, newId, nowISO } from "@/lib/db";
import { employerFor, providerFor, staffRoleFor } from "@/lib/team";
import { HOME, normalizeRole } from "@/lib/permissions";

export async function POST(req: Request) {
  if (isDemo()) return new NextResponse("Not found", { status: 404 });
  const { accessToken, refreshToken, intent } = (await req.json()) as { accessToken?: string; refreshToken?: string; intent?: "worker" | "employer" };
  if (!accessToken) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  const user = data.user;

  let { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const store = await db();
  const email = user.email?.toLowerCase();
  // Team roles are re-read at every sign-in, so promotions and removals take effect right away.
  const staffRole = await staffRoleFor(email);
  if (staffRole) {
    profile = { id: user.id, role: staffRole, worker_id: null, employer_id: null };
    const { error: upErr } = await admin.from("profiles").upsert(profile);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  } else if (profile && (profile.role === "admin" || profile.role === "recruiter" || profile.role === "staff")) {
    return NextResponse.json({ error: "Your team access was removed. Ask an admin to add you again." }, { status: 403 });
  } else if (!profile) {
    const asWorker = intent === "worker";
    const emp = email && !asWorker ? await employerFor(email) : null;
    const prov = email && !asWorker && !emp ? await providerFor(email) : null;
    if (emp) {
      // Company contact or an added hiring manager (Employer → Team).
      profile = { id: user.id, role: "employer", worker_id: null, employer_id: emp.employerId };
    } else if (prov) {
      profile = { id: user.id, role: "provider", worker_id: null, employer_id: null, provider_id: prov.id };
    } else if (email && asWorker) {
      // Workers can sign in by email (no Twilio needed); they add a phone during signup.
      const workers = store.table("workers");
      let worker = (await workers.list()).find((w) => w.email?.toLowerCase() === email);
      if (!worker) {
        worker = { id: newId(), phone: `pending:${newId()}`, email, alerts: "email", name: "", lang: "en", zip: null, radiusMiles: 30, shifts: [], trade: null, yearsExperience: null, nccerLevel: 0,
          skills: [], summary: "", consentSms: false, onboardingComplete: false, createdAt: nowISO() };
        await workers.upsert(worker);
      }
      profile = { id: user.id, role: "worker", worker_id: worker.id, employer_id: null };
    } else if (email) {
      return NextResponse.json({ error: "No employer or training-provider account for this email yet. Workers: choose “I'm looking for work”. Companies: contact us to get set up." }, { status: 403 });
    } else if (user.phone) {
      const phone = user.phone.startsWith("+") ? user.phone : "+" + user.phone;
      const workers = store.table("workers");
      let worker = (await workers.list({ phone })).at(0);
      if (!worker) {
        worker = { id: newId(), phone, name: "", lang: "en", zip: null, radiusMiles: 30, shifts: [], trade: null, yearsExperience: null, nccerLevel: 0,
          skills: [], summary: "", consentSms: false, onboardingComplete: false, createdAt: nowISO() };
        await workers.upsert(worker);
      }
      profile = { id: user.id, role: "worker", worker_id: worker.id, employer_id: null };
    } else {
      return NextResponse.json({ error: "unsupported sign-in" }, { status: 400 });
    }
    const { error: insErr } = await admin.from("profiles").insert(profile);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const res = NextResponse.json({ role: profile.role, home: HOME[normalizeRole(profile.role) ?? "worker"] });
  const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  res.cookies.set("cp_token", accessToken, { ...cookie, maxAge: 60 * 60 });
  if (refreshToken) res.cookies.set("cp_refresh", refreshToken, { ...cookie, maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("cp_token");
  res.cookies.delete("cp_refresh");
  return res;
}
