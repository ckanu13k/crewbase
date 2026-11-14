// Twilio Voice webhook: the same onboarding, spoken. Each answer comes back as SpeechResult or Digits.
import { handleInbound } from "@/lib/onboarding/engine";
import { appUrl, engineDeps } from "@/lib/onboarding/runtime";
import { sendSms, xmlEscape } from "@/lib/messaging";
import { verifyTwilio } from "@/lib/twilio-verify";
import { allow } from "@/lib/ratelimit";

const toSpeech = (s: string, es: boolean) =>
  s
    // Keywords that only make sense by text.
    .replace(/Reply STOP anytime to opt out, HELP for help\. /, "")
    .replace(/Responde STOP para salir o AYUDA para ayuda\. /, "")
    .replace(/Reply YES to continue\./, "Say yes or press 1 to continue.")
    .replace(/Responde SÍ para continuar\./, "Di sí o marca 1 para continuar.")
    .replace(/Reply YES to continue, or STOP to opt out\./, "Say yes or press 1 to continue.")
    .replace(/Responde SÍ para continuar, o STOP para salir\./, "Di sí o marca 1 para continuar.")
    .replace(/https?:\/\/\S+/g, es ? "el enlace que te mandamos por texto" : "the link we'll text you")
    .replace(/\bReply\b/g, "Say or press")
    .replace(/\breply\b/g, "say or press")
    .replace(/\bResponde\b/g, "Di o marca")
    .replace(/\bresponde\b/g, "di o marca")
    .replace(/(\d)\)/g, "$1,");

export async function POST(req: Request) {
  const params = Object.fromEntries(new URLSearchParams(await req.text()));
  if (!verifyTwilio(req, params)) return new Response("Invalid signature", { status: 403 });

  const from = String(params.From ?? "");
  if (!(await allow(`voice:${from}`, 80, 600))) return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, { headers: { "Content-Type": "text/xml" } });
  const answer = String(params.SpeechResult ?? params.Digits ?? (params.CallStatus === "ringing" ? "" : ""));
  const deps = await engineDeps(appUrl(new URL(req.url).origin));
  const result = await handleInbound(deps, { channel: "voice", address: from, text: answer });

  const es = result.session.lang === "es";
  const voiceLang = es ? "es-MX" : "en-US";
  const said = result.replies.map((r) => toSpeech(r, es)).join(" ");
  const action = `${deps.appUrl}/api/twilio/voice`;

  let body: string;
  if (result.done) {
    // Text them the link so they can add card photos.
    for (const r of result.replies) await sendSms(from, r);
    body = `<Say language="${voiceLang}">${xmlEscape(said)}</Say><Hangup/>`;
  } else {
    // Long free-text answers (experience) need a longer pause before Twilio stops listening.
    const long = ["experience", "fix", "trade", "name"].includes(result.session.step);
    body =
      `<Gather input="speech dtmf" language="${voiceLang}" speechTimeout="${long ? 3 : "auto"}" timeout="8" action="${xmlEscape(action)}" method="POST">` +
      `<Say language="${voiceLang}">${xmlEscape(said)}</Say></Gather>` +
      `<Redirect method="POST">${xmlEscape(action)}</Redirect>`;
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });
}
