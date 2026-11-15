import "server-only";
import { isDemo } from "./db";

/** What's connected (booleans only — never values) and what each one turns on. */
export function integrations() {
  const e = process.env;
  return [
    { key: "supabase", name: "Supabase (database + sign-in)", on: !isDemo(), enables: "Live mode: real accounts and data", where: "Vercel env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_*" },
    { key: "smtp", name: "Email sender for sign-in codes", on: null, enables: "Employers and staff receiving sign-in emails (Supabase's built-in sender only reaches your own team)", where: "Supabase → Authentication → SMTP Settings" },
    { key: "twilio", name: "Twilio", on: Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN), enables: "Worker phone sign-in, signup by text/voice, job texts, reminders", where: "Vercel env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN; Supabase → Auth → Phone (Twilio Verify)" },
    { key: "twilioSender", name: "Twilio sending number", on: Boolean(e.TWILIO_MESSAGING_SERVICE_SID || e.TWILIO_FROM_NUMBER), enables: "Outgoing texts (needs A2P 10DLC registration)", where: "Vercel env: TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER" },
    { key: "anthropic", name: "Claude (Anthropic)", on: Boolean(e.ANTHROPIC_API_KEY), enables: "Card photo reading, profile extraction, plain-language gap explanations", where: "Vercel env: ANTHROPIC_API_KEY" },
    { key: "stripe", name: "Stripe", on: Boolean(e.STRIPE_SECRET_KEY), enables: "Real invoices for placement fees and screenings", where: "Vercel env: STRIPE_SECRET_KEY" },
    { key: "checkr", name: "Checkr", on: Boolean(e.CHECKR_API_KEY), enables: "Automated background checks / drug screens (manual mode otherwise)", where: "Vercel env: CHECKR_API_KEY, CHECKR_PACKAGE_BACKGROUND, CHECKR_PACKAGE_DRUG" },
    { key: "cron", name: "Daily reminders", on: Boolean(e.CRON_SECRET), enables: "Card-expiry texts every morning", where: "Vercel env: CRON_SECRET (schedule in vercel.json)" },
    { key: "admins", name: "Owner admin emails", on: Boolean(e.ADMIN_EMAILS || e.STAFF_EMAILS), enables: "Always-admin access for the owners", where: "Vercel env: ADMIN_EMAILS (comma-separated)" },
  ];
}
