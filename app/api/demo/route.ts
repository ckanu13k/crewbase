// Demo-only sign-in (no passwords) and reset. Disabled when Supabase is configured.
import { NextResponse } from "next/server";
import { isDemo } from "@/lib/db";
import { HOME, normalizeRole } from "@/lib/permissions";

export async function POST(req: Request) {
  if (!isDemo()) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const action = String(form.get("action"));
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

  if (action === "reset") {
    const { resetMemoryStore } = await import("@/lib/db/memory");
    await resetMemoryStore();
    const res = NextResponse.redirect(new URL("/", req.url), 303);
    for (const c of ["cp_role", "cp_worker", "cp_employer", "cp_webkey", "cp_provider", "cp_member"]) res.cookies.delete(c);
    return res;
  }
  if (action === "logout") {
    const res = NextResponse.redirect(new URL("/", req.url), 303);
    for (const c of ["cp_role", "cp_worker", "cp_employer", "cp_webkey", "cp_provider", "cp_member"]) res.cookies.delete(c);
    return res;
  }

  const role = normalizeRole(String(form.get("role")));
  if (!role) return new NextResponse("Bad role", { status: 400 });
  const target = HOME[role];
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set("cp_role", role, opts);
  if (role === "worker") {
    res.cookies.set("cp_worker", String(form.get("workerId") ?? "w1"), opts);
    const lang = form.get("lang");
    if (lang === "es" || lang === "en") res.cookies.set("cp_lang", lang, { ...opts, httpOnly: false });
  }
  if (role === "employer") res.cookies.set("cp_employer", String(form.get("employerId") ?? "e1"), opts);
  if (role === "provider") res.cookies.set("cp_provider", String(form.get("providerId") ?? "pr1"), opts);
  if (role === "admin" || role === "recruiter") res.cookies.set("cp_member", String(form.get("memberId") ?? (role === "admin" ? "tm1" : "tm2")), opts);
  return res;
}
