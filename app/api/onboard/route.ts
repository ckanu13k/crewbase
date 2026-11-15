// Web chat onboarding. Same engine as SMS; the browser key cookie is the "address".
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { handleInbound } from "@/lib/onboarding/engine";
import { engineDeps } from "@/lib/onboarding/runtime";
import { db, isDemo } from "@/lib/db";
import { getSession } from "@/lib/session";
import { allow, clientIp } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const c = await cookies();
  let key = c.get("cp_webkey")?.value;
  if (!key) key = crypto.randomUUID();

  // ~1 message every 10 s on average per browser, and a looser cap per IP (shared phones, job sites).
  if (!(await allow(`onboard:key:${key}`, 60, 600)) || !(await allow(`onboard:ip:${clientIp(req)}`, 300, 600))) {
    return NextResponse.json({ error: "Too many messages. Wait a few minutes and try again." }, { status: 429 });
  }
  const form = await req.formData();
  const text = String(form.get("text") ?? "");
  const files = form.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.some((f) => f.size > 8 * 1024 * 1024)) return NextResponse.json({ error: "Photo too large (8 MB max)" }, { status: 413 });

  let knownPhone: string | null = null;
  let knownWorkerId: string | null = null;
  if (!isDemo()) {
    const s = await getSession();
    if (!s?.workerId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    const phone = (await (await db()).table("workers").get(s.workerId))?.phone ?? null;
    // Email sign-ins start with a placeholder phone; the chat then asks for a real one.
    knownPhone = phone && /^\+\d{8,15}$/.test(phone) ? phone : null;
    knownWorkerId = s.workerId;
  }

  const deps = await engineDeps(new URL(req.url).origin);
  const media = await Promise.all(files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), contentType: f.type || "image/jpeg" })));
  const result = await handleInbound(deps, { channel: "web", address: key, text, media, knownPhone, knownWorkerId });

  const res = NextResponse.json({ replies: result.replies, step: result.session.step, done: result.done, lang: result.session.lang });
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };
  res.cookies.set("cp_webkey", key, opts);
  res.cookies.set("cp_lang", result.session.lang, { ...opts, httpOnly: false });
  if (isDemo() && result.workerId) {
    res.cookies.set("cp_role", "worker", opts);
    res.cookies.set("cp_worker", result.workerId, opts);
  }
  return res;
}
