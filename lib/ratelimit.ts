import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isDemo } from "./db";

const mem = new Map<string, { windowStart: number; count: number }>();

/**
 * True if the request is allowed. Live mode uses the rate_limit_hit() Postgres function so the limit
 * holds across serverless instances; demo mode counts in memory. Fails open if the database errors,
 * so a rate-limit outage never blocks a worker's signup.
 */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (isDemo()) {
    const now = Date.now();
    const start = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
    const cur = mem.get(key);
    const next = cur && cur.windowStart === start ? { windowStart: start, count: cur.count + 1 } : { windowStart: start, count: 1 };
    mem.set(key, next);
    return next.count <= max;
  }
  try {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[ratelimit] failing open:", err instanceof Error ? err.message : err);
    return true;
  }
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
