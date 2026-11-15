import "server-only";
// Transactional email. Uses Resend's HTTP API when RESEND_API_KEY + EMAIL_FROM are set; otherwise
// the message is logged to the outbox as "simulated" (same as texts in the demo).
// The same Resend account can be Supabase's custom SMTP sender, which unblocks email sign-in too.
import { db, newId, nowISO } from "./db";
import type { OutboxMessage } from "./types";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string): Promise<OutboxMessage> {
  const msg: OutboxMessage = { id: newId(), to, body: `${subject}\n\n${text}`, channel: "email", status: "simulated", providerId: null, createdAt: nowISO() };
  if (emailConfigured() && !/@example\.(com|org|net)$/i.test(to)) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      msg.status = res.ok ? "sent" : "failed";
      msg.providerId = data.id ?? null;
    } catch (e) {
      msg.status = "failed";
      console.error("[email] send failed:", e instanceof Error ? e.message : e);
    }
  }
  await (await db()).table("outbox").upsert(msg);
  return msg;
}

/** Everyone who can sign in for an employer: the company contact plus added hiring managers. */
export async function employerRecipients(employerId: string): Promise<string[]> {
  const store = await db();
  const [e, users] = await Promise.all([store.table("employers").get(employerId), store.table("employer_users").list({ employerId } as never)]);
  return [...new Set([e?.email, ...users.map((u) => u.email)].filter((x): x is string => Boolean(x && x.includes("@"))))];
}

export async function emailEmployer(employerId: string, subject: string, text: string) {
  for (const to of await employerRecipients(employerId)) await sendEmail(to, subject, text);
}
