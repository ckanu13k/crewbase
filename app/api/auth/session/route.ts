// Live mode: the browser signs in with Supabase Auth (OTP) and hands us the access token.
// We verify it, make sure a profile exists, and store the token in an httpOnly cookie.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db, isDemo, newId, nowISO } from "@/lib/db";

export async function POST(req: Request) {
  if (isDemo()) return new NextResponse("Not found", { status: 404 });
  const { accessToken, refreshToken } = (await req.json()) as { accessToken?: string; refreshToken?: string };
  if (!accessToken) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  const user = data.user;

  let { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    const store = await db();
    const staffEmails = (process.env.STAFF_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const email = user.email?.toLowerCase();
    if (email && staffEmails.includes(email)) {
      profile = { id: user.id, role: "staff", worker_id: null, employer_id: null };
    } else if (email) {
      // Employers are created by staff first (Recruiter → Employers); their contact email unlocks sign-in.
      const employer = (await store.table("employers").list()).find((e) => e.email.toLowerCase() === email);
      if (!employer) return NextResponse.json({ error: "No employer account for this email yet. Contact us to get set up." }, { status: 403 });
      profile = { id: user.id, role: "employer", worker_id: null, employer_id: employer.id };
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

  const res = NextResponse.json({ role: profile.role });
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
