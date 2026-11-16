import "server-only";
// Fire an event to the employer's ATS webhook, if they set one. Logged to the activity log; never blocks the action.
import { db } from "./db";
import { audit } from "./audit";
import { deliverWebhook, type WebhookEvent } from "./webhooks";
import { appUrl } from "./onboarding/runtime";
import { credShort, tradeLabel } from "./taxonomy";
import type { Credential, Job, Worker } from "./types";

/** The worker as an ATS sees them: first name + last initial, trade, verified cards. No contact details. */
export function candidatePayload(w: Worker, creds: Credential[], job: Job) {
  const [first, last] = w.name.split(" ");
  return {
    candidate: { id: w.id, name: `${first ?? ""} ${last ? last[0] + "." : ""}`.trim(), trade: tradeLabel(w.trade, "en"), yearsExperience: w.yearsExperience, language: w.lang },
    verifiedCards: creds.filter((c) => c.verification === "verified").map((c) => ({ card: credShort(c.type), expiresOn: c.expiresOn })),
    job: { id: job.id, title: job.title, startDate: job.startDate, hireType: job.hireType ?? "direct" },
    link: `${appUrl()}/employer/jobs/${job.id}`,
  };
}

export async function fireEmployerWebhook(employerId: string, event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const e = await (await db()).table("employers").get(employerId);
    if (!e?.atsWebhookUrl || !e.atsWebhookSecret) return null;
    const r = await deliverWebhook(e.atsWebhookUrl, e.atsWebhookSecret, event, data);
    await audit(null, r.ok ? "webhook.delivered" : "webhook.failed", "employer", employerId, `${event} → ${new URL(e.atsWebhookUrl).host}: ${r.ok ? `HTTP ${r.status}` : r.error}`);
    return r;
  } catch (err) {
    console.error("[ats] webhook error", err instanceof Error ? err.message : err);
    return null;
  }
}
