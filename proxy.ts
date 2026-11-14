// Live mode only: keeps Supabase sessions alive. When the access token is within 5 minutes of
// expiring, swap the refresh token for a new pair and pass the fresh token to the page.
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

function expiresAt(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return Number(payload.exp) * 1000;
  } catch {
    return 0;
  }
}

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.cookies.get("cp_token")?.value;
  const refresh = request.cookies.get("cp_refresh")?.value;
  if (!url || !anon || !refresh || (token && expiresAt(token) - Date.now() > 5 * 60_000)) return NextResponse.next();

  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  }).catch(() => null);
  if (!res?.ok) {
    const out = NextResponse.next();
    out.cookies.delete("cp_refresh");
    return out;
  }
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  request.cookies.set("cp_token", data.access_token);
  const out = NextResponse.next({ request: { headers: request.headers } });
  out.cookies.set("cp_token", data.access_token, { ...COOKIE, maxAge: data.expires_in });
  out.cookies.set("cp_refresh", data.refresh_token, { ...COOKIE, maxAge: 60 * 60 * 24 * 30 });
  return out;
}

export const config = {
  // Pages and server actions; skip static files and the Twilio/cron webhooks.
  matcher: ["/((?!_next/|icons/|api/twilio|api/cron|favicon.ico|icon.png|sw.js|manifest.webmanifest).*)"],
};
