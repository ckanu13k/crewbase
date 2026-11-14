import "server-only";
import { validateRequest } from "twilio/lib/webhooks/webhooks";

/**
 * Checks X-Twilio-Signature. Skipped only when TWILIO_AUTH_TOKEN is unset (local demo).
 * Behind a proxy, set APP_URL so the URL we sign matches the one Twilio called.
 */
export function verifyTwilio(req: Request, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const u = new URL(req.url);
  const url = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, "") + u.pathname + u.search : req.url;
  return validateRequest(token, sig, url, params);
}
