# CrewPass — craft jobs and training (MVP)

Working name. A mobile-first PWA for the Houston industrial/construction wedge in the product plan:

- **Workers** sign up in ~5 minutes by **SMS, WhatsApp, a phone call, or web chat**, in **English or Spanish**. Claude turns their own words into a profile (trade, years, NCCER level, skills, cards) and reads photos of their cards (type, number, dates).
- A **credential wallet** with verification badges (self-reported → photo on file → verified) and **expiry texts** at 60/30/7/0 days.
- A **rules-based matching and gap engine** (O*NET-coded trades, per-trade skills, NCCER levels, card validity judged on the job's start date, distance, shift). The "what you're missing" view links each gap to training with start dates and ways to pay (WIOA, Workforce Pell, Skills Development Fund, employer).
- **Employers** post jobs and see a verified shortlist. **Recruiters** review card photos, rank candidates, text workers, run the pipeline, confirm day 30 and invoice the placement fee through **Stripe Invoicing**.
- Bilingual OSHA-prep and blueprint-reading practice quizzes (prep only).

## Run it (demo mode, no keys needed)

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # matching engine + SMS onboarding tests
```

Demo mode uses fictional sample workers, employers, jobs and training programs (stored in `.data/demo.json`; "Reset demo data" on the home page restores them). Pick a worker, an employer or the recruiter console from the home page. Texts go to **Recruiter → Texts** instead of phones. Without `ANTHROPIC_API_KEY`, profile extraction falls back to a keyword extractor and card photos go to the review queue unread.

## Go live (Vercel + Supabase)

1. **Supabase**: create a project. In the SQL editor run `supabase/migrations/0001_init.sql`, then `0002_rate_limits.sql`.
   - Auth → Providers → **Email**: on. Auth → Email templates → **Magic link**: include `{{ .Token }}` so people get a 6-digit code (the sign-in screen asks for a code, not a link).
   - Auth → Providers → **Phone**: on, provider **Twilio Verify** (no A2P 10DLC needed for Verify codes).
   - Auth → URL configuration: set the Site URL to your Vercel URL.
2. **Vercel**: import the GitHub repo and set env vars from `.env.example`. At minimum: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STAFF_EMAILS`, `APP_URL`, `CRON_SECRET`. Demo mode turns off as soon as the Supabase vars are present. Check `/api/health` after each deploy.
3. **Training data**: download the TWC Statewide ETPL CSV, check the column names in `scripts/etpl-mapping.json`, then `npm run import:etpl -- etpl.csv` with the Supabase env vars set. ETPL has no class dates; add them in **Recruiter → Training**, where you can also add programs by hand.
4. **ZIP map**: `npm run import:zcta -- 2024_Gaz_zcta_national.txt` (Census Gazetteer), commit `data/zcta.json`, redeploy.
5. **Twilio**: register **A2P 10DLC** (brand + campaign) before texting job matches; approval can take weeks. Point the number's Messaging webhook to `POST {APP_URL}/api/twilio/sms` and Voice webhook to `POST {APP_URL}/api/twilio/voice`. Add a WhatsApp sender with the same messaging webhook if you want WhatsApp. Turn on Advanced Opt-Out; the app also handles STOP/START/HELP.
6. **Claude**: set `ANTHROPIC_API_KEY`. Default model is `claude-haiku-5-5`; change with `ANTHROPIC_MODEL`.
7. **Stripe**: set `STRIPE_SECRET_KEY`. "Create invoice" on a day-30-confirmed placement creates, finalizes and emails a net-15 invoice.
8. **Cron**: `vercel.json` runs the expiry-reminder texts daily at 14:00 UTC (8 or 9 am in Houston), authenticated with `CRON_SECRET`.

Sign-in: workers use their phone (one-time code); employers and staff use email codes. Staff = any email in `STAFF_EMAILS`. Employers can sign in once a recruiter adds their company with that contact email (Recruiter → Employers). Sessions refresh automatically for 30 days (`proxy.ts`).

## Where things live

| Area | Files |
| --- | --- |
| Taxonomy (trades, skills, cards, validity) | `lib/taxonomy.ts` |
| Matching + gaps (pure, tested) | `lib/matching.ts`, `lib/training.ts`, `lib/matching.test.ts` |
| Onboarding conversation (all channels) | `lib/onboarding/engine.ts`, `engine.test.ts` |
| Claude calls (structured outputs, with fallbacks) | `lib/ai/*` |
| Twilio webhooks | `app/api/twilio/sms`, `app/api/twilio/voice`, `lib/messaging.ts` |
| Data layer (demo store / Supabase) | `lib/db/*`, `supabase/migrations/0001_init.sql` |
| Worker screens | `app/me/*`, `app/training`, `app/learn` |
| Employer screens | `app/employer/*` |
| Recruiter console | `app/recruiter/*`, `app/actions.ts` |
| Placement invoices | `lib/billing.ts` |
| Session refresh, rate limits, health | `proxy.ts`, `lib/ratelimit.ts`, `app/api/health` |

## Pricing defaults

Placement fee defaults (estimates from the plan, editable per job): $3,000 helper/entry, $4,000 mid, $5,000 journey-level. Due on day 30; free replacement if the hire leaves before day 90 (the job reopens automatically).

## Before real users — known gaps

- **Rate limits** (shared in Postgres): web signup 60 messages/10 min per browser and 300 per IP; SMS 40/10 min and calls 80/10 min per number; card uploads 20/hour per worker. Tune in the route files.
- **Card verification is manual.** I found no public NCCER API; recruiters check the registry, TDLR license search, etc. The review screen shows how for each card type.
- **Validity defaults marked `estimated`** in `lib/taxonomy.ts` (e.g. Basic Plus, H2S, AWS continuity) need checking against issuers.
- **Spanish voice recognition** quality is untested on real calls; test with real workers before relying on the phone line.
- **Legal review**: TCPA consent wording, data retention for card photos (PII), and FCRA (don't run background checks in-app).
- The skills list is a seed (5–15 per trade). The plan calls for 30–50 per trade.
