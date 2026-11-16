// Live mode: the browser signs in with Supabase Auth (OTP) and hands us the access token.
// We verify it, make sure a profile exists, and store the token in an httpOnly cookie.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db, isDemo, newId, nowISO } from "@/lib/db";
import { employerFor, providerFor, staffRoleFor } from "@/lib/team";
import { decideSignIn } from "@/lib/signin";
import { HOME, normalizeRole } from "@/lib/permissions";

export async function POST(req: Request) {
  if (isDemo()) return new NextResponse("Not found", { status: 404 });
  const { accessToken, refreshToken, intent } = (await req.json()) as { accessToken?: string; refreshToken?: string; intent?: "worker" | "employer" };
  if (!accessToken) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  const user = data.user;

  const store = await db();
  const email = user.email?.toLowerCase() ?? null;
  const phone = user.phone ? (user.phone.startsWith("+") ? user.phone : "+" + user.phone) : null;
  // What the person chose on the sign-in screen decides who they are this time.
  // "I'm looking for work" (phone or email) always means the worker side — even for a founder or
  // employer email — so nobody lands in the admin or company screens by picking "worker".
  const staffRole = email ? await staffRoleFor(email) : null;
  const emp = email && !staffRole ? await employerFor(email) : null;
  const prov = email && !staffRole && !emp ? await providerFor(email) : null;
  const decision = decideSignIn({ intent, email, phone, staffRole, employerId: emp?.employerId ?? null, providerId: prov?.id ?? null });
  let profile: { id: string; role: string; worker_id: string | null; employer_id: string | null; provider_id: string | null };

  if (decision.kind === "worker") {
    const workers = store.table("workers");
    const all = await workers.list();
    let worker = phone ? all.find((w) => w.phone === phone) : all.find((w) => w.email?.toLowerCase() === email);
    if (!worker) {
      worker = {
        id: newId(), phone: phone ?? `pending:${newId()}`, email, alerts: phone ? "sms" : "email", name: "", lang: "en", zip: null, radiusMiles: 30,
        shifts: [], trade: null, yearsExperience: null, nccerLevel: 0, skills: [], summary: "", consentSms: false, onboardingComplete: false, createdAt: nowISO(),
      };
      await workers.upsert(worker);
    }
    profile = { id: user.id, role: "worker", worker_id: worker.id, employer_id: null, provider_id: null };
  } else if (decision.kind === "admin" || decision.kind === "recruiter") {
    profile = { id: user.id, role: decision.kind, worker_id: null, employer_id: null, provider_id: null };
  } else if (decision.kind === "employer") {
    profile = { id: user.id, role: "employer", worker_id: null, employer_id: decision.employerId, provider_id: null };
  } else if (decision.kind === "provider") {
    profile = { id: user.id, role: "provider", worker_id: null, employer_id: null, provider_id: decision.providerId };
  } else {
    return NextResponse.json({ error: "No company, staff or training-provider account for this email. Looking for work? Choose “Worker” instead." }, { status: 403 });
  }
  const { error: upErr } = await admin.from("profiles").upsert(profile);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

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
