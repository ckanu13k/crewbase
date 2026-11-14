// Twilio Messaging webhook (SMS, MMS and WhatsApp). Point the number or Messaging Service here.
import { handleInbound } from "@/lib/onboarding/engine";
import { appUrl, engineDeps } from "@/lib/onboarding/runtime";
import { twiml } from "@/lib/messaging";
import { verifyTwilio } from "@/lib/twilio-verify";
import { allow } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const params = Object.fromEntries(new URLSearchParams(await req.text()));
  if (!verifyTwilio(req, params)) return new Response("Invalid signature", { status: 403 });

  const rawFrom = String(params.From ?? "");
  const channel = rawFrom.startsWith("whatsapp:") ? "whatsapp" : "sms";
  const address = rawFrom.replace(/^whatsapp:/, "");
  // Silently drop floods (no reply = no cost). 40 messages per 10 minutes per number.
  if (!(await allow(`sms:${address}`, 40, 600))) return new Response(twiml([]), { headers: { "Content-Type": "text/xml" } });
  const media = Array.from({ length: Number(params.NumMedia ?? 0) }, (_, i) => ({
    url: String(params[`MediaUrl${i}`]),
    contentType: String(params[`MediaContentType${i}`] ?? "image/jpeg"),
  })).filter((m) => m.contentType.startsWith("image/"));

  const deps = await engineDeps(appUrl(new URL(req.url).origin));
  const result = await handleInbound(deps, { channel, address, text: String(params.Body ?? ""), media });
  return new Response(twiml(result.replies), { headers: { "Content-Type": "text/xml" } });
}
