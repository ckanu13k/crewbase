import "server-only";
import { db, newId, nowISO } from "./db";
import type { OutboxMessage } from "./types";

export const twilioConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER));

/**
 * Sends an SMS (or WhatsApp) message. Without Twilio credentials the message is only logged to the
 * outbox as "simulated", which is what the demo's Outbox screen shows.
 */
/** 555-0100…0199 numbers are reserved for fiction; demo people use them and are never really texted. */
export const isFictionalNumber = (to: string) => /^\+1\d{3}55501\d{2}$/.test(to);

export async function sendSms(to: string, body: string, channel: "sms" | "whatsapp" = "sms"): Promise<OutboxMessage> {
  const store = await db();
  const msg: OutboxMessage = { id: newId(), to, body, channel, status: "simulated", providerId: null, createdAt: nowISO() };
  // Email-only workers have a placeholder until they add a phone; never try to text that.
  if (!/^\+\d{8,15}$/.test(to)) msg.status = "failed";
  else if (twilioConfigured() && !isFictionalNumber(to)) {
    try {
      const { default: twilio } = await import("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const prefix = channel === "whatsapp" ? "whatsapp:" : "";
      const res = await client.messages.create({
        to: prefix + to,
        body,
        ...(process.env.TWILIO_MESSAGING_SERVICE_SID ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID } : { from: prefix + process.env.TWILIO_FROM_NUMBER! }),
      });
      msg.status = "sent";
      msg.providerId = res.sid;
    } catch (err) {
      msg.status = "failed";
      console.error("[sms] send failed:", err instanceof Error ? err.message : err);
    }
  }
  await store.table("outbox").upsert(msg);
  return msg;
}

export function twiml(messages: string[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${messages.map((m) => `<Message>${esc(m)}</Message>`).join("")}</Response>`;
}

export function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
