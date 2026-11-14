// Demo-only sign-in (no passwords) and reset. Disabled when Supabase is configured.
import { NextResponse } from "next/server";
import { isDemo } from "@/lib/db";

export async function POST(req: Request) {
  if (!isDemo()) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const action = String(form.get("action"));
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

  if (action === "reset") {
    const { resetMemoryStore } = await import("@/lib/db/memory");
    await resetMemoryStore();
    const res = NextResponse.redirect(new URL("/", req.url), 303);
    for (const c of ["cp_role", "cp_worker", "cp_employer", "cp_webkey"]) res.cookies.delete(c);
    return res;
  }
  if (action === "logout") {
    const res = NextResponse.redirect(new URL("/", req.url), 303);
    for (const c of ["cp_role", "cp_worker", "cp_employer", "cp_webkey"]) res.cookies.delete(c);
    return res;
  }

  const role = String(form.get("role"));
  const target = role === "worker" ? "/me" : role === "employer" ? "/employer" : "/recruiter";
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set("cp_role", role, opts);
  if (role === "worker") {
    res.cookies.set("cp_worker", String(form.get("workerId") ?? "w1"), opts);
    const lang = form.get("lang");
    if (lang === "es" || lang === "en") res.cookies.set("cp_lang", lang, { ...opts, httpOnly: false });
  }
  if (role === "employer") res.cookies.set("cp_employer", String(form.get("employerId") ?? "e1"), opts);
  return res;
}
