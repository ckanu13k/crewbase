// Daily credential-expiry texts, new-job alerts and next-day pay. Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { runExpiryReminders } from "@/lib/reminders";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : can((await getSession())?.role, "settings");
  if (!authed) return new NextResponse("Unauthorized", { status: 401 });
  const sent = await runExpiryReminders();
  const { runJobAlerts } = await import("@/lib/alerts");
  const alerts = await runJobAlerts();
  const { sendDueNextDayPayouts } = await import("@/lib/crew");
  const payouts = await sendDueNextDayPayouts();
  return NextResponse.json({ sent: sent.length, details: sent, jobAlerts: alerts.length, nextDayPayouts: payouts });
}
