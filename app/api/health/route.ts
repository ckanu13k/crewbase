// Which integrations are configured (booleans only, never values), and whether the database answers.
import { NextResponse } from "next/server";
import { db, isDemo } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "demo";
  if (!isDemo()) {
    try {
      await (await db()).table("training_programs").list({ id: "__health__" });
      database = "ok";
    } catch (e) {
      database = "error: " + (e instanceof Error ? e.message.slice(0, 120) : "unknown");
    }
  }
  return NextResponse.json({
    mode: isDemo() ? "demo" : "live",
    database,
    appUrl: Boolean(process.env.APP_URL),
    supabasePublic: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    staffEmails: Boolean(process.env.STAFF_EMAILS),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    twilioSender: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  });
}
