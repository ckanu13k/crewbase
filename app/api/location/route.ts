import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { LOC_COOKIE, describe, resolvePick } from "@/lib/location";
import { allow } from "@/lib/ratelimit";

// Saves where to search from. Body: {lat, lng} from the device, or {zip}.
// Workers: also saved to their profile so matching uses it. Everyone else: a cookie in this browser.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await allow(`loc:${ip}`, 30, 60))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const r = resolvePick(body ?? {});
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });

  const jar = await cookies();
  jar.set(LOC_COOKIE, JSON.stringify(r), { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });

  const session = await getSession();
  if (session?.role === "worker" && session.workerId) {
    const store = await db();
    const w = await store.table("workers").get(session.workerId);
    if (w) await store.table("workers").upsert({ ...w, zip: r.zip, lat: r.lat, lng: r.lng });
  }
  return NextResponse.json({ ok: true, zip: r.zip, label: describe(r.zip, r.lat !== null ? "device" : "zip") });
}
