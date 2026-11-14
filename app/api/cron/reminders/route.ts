// Daily credential-expiry texts. Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
import { NextResponse } from "next/server";
import { runExpiryReminders } from "@/lib/reminders";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = secret ? req.headers.get("authorization") === `Bearer ${secret}` : (await getSession())?.role === "staff";
  if (!authed) return new NextResponse("Unauthorized", { status: 401 });
  const sent = await runExpiryReminders();
  return NextResponse.json({ sent: sent.length, details: sent });
}
