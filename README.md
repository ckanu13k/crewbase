# CrewPass — craft jobs and training (MVP)

Working name. A mobile-first PWA for Greater Houston hourly and craft work in four sectors: **plants & fab shops**, **construction**, **warehouses** and **homes & apartments** (23 trades, from pipefitter to forklift operator, carpenter, painter and maintenance tech). Two ways to hire: **direct hire** (one placement fee) or **temp crews** (CrewPass is the employer of record and bills hourly).

- **Workers** sign up in ~5 minutes by **SMS, WhatsApp, a phone call, or web chat**, in **English or Spanish**. Claude turns their own words into a profile (trade, years, NCCER level, skills, cards) and reads photos of their cards (type, number, dates).
- A **credential wallet** with verification badges (self-reported → photo on file → verified) and **expiry texts** at 60/30/7/0 days.
- A **rules-based matching and gap engine** (O*NET-coded trades, per-trade skills, NCCER levels, card validity judged on the job's start date, distance, shift). The "what you're missing" view links each gap to training with start dates and ways to pay (WIOA, Workforce Pell, Skills Development Fund, employer).
- **Employers** post jobs and see a verified shortlist. **Recruiters** review card photos, rank candidates, text workers, run the pipeline, confirm day 30 and invoice the placement fee through **Stripe Invoicing**.
- **Temp crews**: clock in/out, timesheets with per diem and work-order numbers, employer approval, FLSA overtime across sites, weekly pay runs with a payroll CSV and one invoice per employer, and **next-day or instant pay** (free for workers).
- **Ratings, reliability and "rehire my crew"**: employers rate quality, safety and rehire after each job; reliability comes from actual attendance; rosters let an employer offer a new job to past crew in one tap.
- **Skills tests** (timed, random draw, graded on the server, retake wait) plus **hands-on checks** recorded by staff; employers see the results on candidate cards. Practice quizzes stay separate.
- **Benefits** page for temp workers (plans, hours toward ACA eligibility), **interview scheduling** (employer offers slots, worker books by text link, calendar file), **ATS webhooks** (signed), and **pay comparison** by trade and area (shown only with enough samples).

## Run it (demo mode, no keys needed)

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # matching engine + SMS onboarding tests
```

Demo mode uses fictional sample workers, employers, jobs and training programs (stored in `.data/demo.json`; "Reset demo data" on the home page restores them). Pick a worker, an employer or the recruiter console from the home page. Texts go to **Recruiter → Texts** instead of phones. Without `ANTHROPIC_API_KEY`, profile extraction falls back to a keyword extractor and card photos go to the review queue unread.

## Go live (Vercel + Supabase)

1. **Supabase**: create a project. In the SQL editor run `supabase/migrations/0001_init.sql`, `0002_rate_limits.sql`, `0003_locations.sql`, `0004_screenings.sql`, `0005_team_roles.sql`, `0006_personas_plus.sql`, `0007_founder_only_admin.sql`, then `0008_sectors_temp_crews.sql` (or all at once: `supabase/setup.sql`). Optional demo board: run `supabase/demo-data.sql` (25 fictional workers, 6 employers, 11 jobs, 10 training programs; regenerate with `npm run demo:sql`). Demo phone numbers are in the reserved 555-01xx range and are never texted.
   - Auth → Providers → **Email**: on. Auth → Email templates → **Magic link**: include `{{ .Token }}` so people get a 6-digit code (the sign-in screen asks for a code, not a link).
   - Auth → Providers → **Phone**: on, provider **Twilio Verify** (no A2P 10DLC needed for Verify codes).
   - Auth → URL configuration: set the Site URL to your Vercel URL.
2. **Vercel**: import the GitHub repo and set env vars from `.env.example`. At minimum: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STAFF_EMAILS`, `APP_URL`, `CRON_SECRET`. Demo mode turns off as soon as the Supabase vars are present. Check `/api/health` after each deploy.
3. **Training data**: download the TWC Statewide ETPL CSV, check the column names in `scripts/etpl-mapping.json`, then `npm run import:etpl -- etpl.csv` with the Supabase env vars set. ETPL has no class dates; add them in **Recruiter → Training**, where you can also add programs by hand.
4. **ZIP map**: `data/zcta.json` ships with Census 2024 Gazetteer centroids for all 77xxx ZIPs (Houston, Golden Triangle, Brazos Valley, Victoria). For more of Texas: `npm run import:zcta -- 2024_Gaz_zcta_national.txt`, commit, redeploy.
5. **Twilio**: register **A2P 10DLC** (brand + campaign) before texting job matches; approval can take weeks. Point the number's Messaging webhook to `POST {APP_URL}/api/twilio/sms` and Voice webhook to `POST {APP_URL}/api/twilio/voice`. Add a WhatsApp sender with the same messaging webhook if you want WhatsApp. Turn on Advanced Opt-Out; the app also handles STOP/START/HELP.
6. **Claude**: set `ANTHROPIC_API_KEY`. Default model is `claude-haiku-5-5`; change with `ANTHROPIC_MODEL`.
7. **Payroll partner** (temp crews): pick an employer-of-record or embedded-payroll provider (they withhold taxes, carry workers' comp, file W-2s and send instant pay), then set `PAYROLL_PROVIDER` and `PAYROLL_API_KEY`. Until then, export each week's CSV from **Admin → Payroll**, run it in the partner's dashboard, and mark payouts sent.
8. **Stripe**: set `STRIPE_SECRET_KEY`. "Create invoice" on a day-30-confirmed placement creates, finalizes and emails a net-15 invoice.
9. **Cron**: `vercel.json` runs the expiry-reminder texts daily at 14:00 UTC (8 or 9 am in Houston), authenticated with `CRON_SECRET`.

Sign-in: workers use their phone (one-time code); employers and staff use email codes. Owners in `ADMIN_EMAILS` (or the older `STAFF_EMAILS`) are always admins; everyone else on the team is added in **Admin → Team**. Employers can sign in once a recruiter adds their company with that contact email (Recruiter → Employers). Sessions refresh automatically for 30 days (`proxy.ts`).

## Where things live

| Area | Files |
| --- | --- |
| Taxonomy (trades, skills, cards, validity) | `lib/taxonomy.ts` |
| Matching + gaps (pure, tested) | `lib/matching.ts`, `lib/training.ts`, `lib/matching.test.ts` |
| Assignment optimizer (min-cost flow, tested vs brute force) | `lib/optimizer.ts`, `lib/optimizer.test.ts`, `lib/plan.ts`, `app/recruiter/optimize` |
| Background checks / drug screens | `lib/screening/*`, `app/screening-actions.ts`, `app/recruiter/screenings`, `app/me/screening`, `app/api/screening/checkr` |
| Location (ZIP centroids, device location, area picker) | `lib/geo.ts`, `lib/location.ts`, `app/api/location`, `components/LocationBar.tsx` |
| Onboarding conversation (all channels) | `lib/onboarding/engine.ts`, `engine.test.ts` |
| Claude calls (structured outputs, with fallbacks) | `lib/ai/*` |
| Twilio webhooks | `app/api/twilio/sms`, `app/api/twilio/voice`, `lib/messaging.ts` |
| Data layer (demo store / Supabase) | `lib/db/*`, `supabase/migrations/0001_init.sql` |
| Worker screens | `app/me/*`, `app/training`, `app/learn` |
| Employer screens | `app/employer/*` |
| Recruiter console | `app/recruiter/*`, `app/actions.ts` |
| Placement invoices | `lib/billing.ts` |
| Session refresh, rate limits, health | `proxy.ts`, `lib/ratelimit.ts`, `app/api/health` |

## Personas and workspaces

| Persona | Lands on | Can do | Can't do |
| --- | --- | --- | --- |
| **Admin** (owner) | `/admin` | Everything below, plus revenue overview, **Billing**, **Employers** (accounts + recruiter assignment), **Team**, **Activity** (audit log), **Training** (+ providers, approvals), **Settings** (integrations, editable business defaults, delete demo data) | — |
| **Recruiter** | `/recruiter` | **To-do** (generated + personal), My accounts / All, Pipeline, Optimizer, card Review, Screening, Workers, Placements (day-30 check, left early), Texts, post/edit jobs | Invoices, payments, team, employer accounts, training directory, settings |
| **Employer** | `/employer` | Their jobs (post, edit, close/reopen), shortlists, **Hires & billing**, **Team** (contact adds hiring managers); email alerts for new candidates, clear screenings, invoices | Other employers' data, worker contact details |
| **Worker** | `/me` | Profile, cards, matched jobs ("New" since last visit), screening authorization, training, practice; sign in by phone **or email**; job alerts by text/email/off; download my data; delete my account | Anything about other people |
| **Training provider** | `/provider` | Their own class listings (dates, cost, requirements), local demand for what they teach (aggregate only); new classes wait for admin approval | Anyone else's listings, any worker identity |
| **Visitor** | `/` | Landing, training directory, practice quizzes, sign-up | — |

Permissions live in `lib/permissions.ts` (tested). Every important action (card checks, screening steps, hires, invoices, team/settings changes, deletions) is written to the activity log (`lib/audit.ts`), never with report contents or card numbers. Team access is re-checked on every request, so removing someone locks them out immediately.

## Matching and location

- **Location**: workers set it during signup (ZIP or "Use my location"), on their profile, or from the home screen. Visitors pick it on Training (stored in a cookie). Device coordinates are rounded to about half a mile; employers only see distances. Distance uses the exact point when known, else the ZIP centroid.
- **Hard rules** (`evaluateMatch`): required cards valid on the start date, travel radius, shift, NCCER level, experience (more than a year short), and trade (cross-trade only with at least half the job's skills; anyone can be a helper). Everything else is scored 0–100.
- **Optimizer** (Recruiter → Optimizer): all open jobs solved at once as a min-cost flow. It fills the most openings first, then maximizes total score; pairs under 60 aren't proposed. Every assignment is re-checked against the rules, and the page compares the result with job-by-job ranking. 2,000 workers × 200 jobs solves in well under a second.
- **Training**: ranked for wherever the user is by how many open positions nearby ask for what the program gives (required or preferred cards, NCCER level, skills), so the list moves when employers change requirements. Staff keep each program's "What employers ask for now" note current in Recruiter → Training; saving marks it reviewed, and programs unreviewed for 90 days are flagged.

## Temp crews, timesheets and pay

- **Posting**: employers pick **Direct hire** or **Temp** on the job form, plus per diem per day worked, a planned end date and a PO / work-order number. Temp jobs show pay-to-worker; the employer is billed pay × (1 + markup) (Admin → Settings, default 45% — an estimate that has to cover payroll taxes, workers' comp, the partner's fee and our margin).
- **Hiring**: marking a temp candidate Hired creates an **assignment** (pay rate, bill rate, per diem, work order) instead of a placement fee, texts the worker, and invites them to payroll onboarding (W-4, I-9, deposit) with the partner.
- **Worker** (`/me/work`): clock in / clock out (or fix times before the employer approves), breaks, per-diem days, and pay speed: **weekly**, **next-day** or **instant**. Early pay is free; it pays straight-time for the approved shift, and overtime premium and per diem settle on payday.
- **Employer** (`/employer/timesheets`): approve, fix times, mark late / no-show / called off, or dispute; "Approve all". Approved shifts trigger early pay for workers who chose it.
- **Founder** (`/admin/payroll`): build the Monday–Sunday pay run. Overtime follows the FLSA: hours over 40 across **all** of a worker's sites that week, premium at half the weighted-average regular rate; each site is billed for its own hours (overtime hours at 1.5× its bill rate) plus per diem at cost. Approve → one Stripe invoice per employer, CSV for the partner → mark paid. Payouts still pending can be settled by hand.
- Per diem is shown separately from wages. Whether it's tax-free depends on the worker traveling away from their tax home under an accountable plan — the payroll partner decides the tax treatment.

## Ratings, reliability and crews

- After a temp assignment or a direct hire, employers rate **quality** and **safety** (1–5) and answer **would you rehire?** Comments are seen by the employer and our team, not the worker; workers see their averages.
- **Reliability** is computed from attendance on timesheets (on time 1, late 0.7, called off 0.5, no-show 0) and appears after 3 shifts.
- **My crew** (`/employer/crew`): workers the employer said they'd rehire. "Offer a job" texts them a link to an open job; recruiters see all rosters in **Recruiter → Crews**.

## Skills tests and hands-on checks

- Five tests with their own question banks (jobsite safety, forklift & warehouse, electrical, pipe math, carpentry — `lib/assessments.ts`), separate from practice quizzes: a random draw, a time limit, server-side grading, no answers shown, one attempt per retake period (default pass 70%, retake after 30 days).
- An in-app test is unproctored and labeled that way. A **hands-on check** is recorded by a recruiter who watched the worker do the task (Recruiter → Workers → worker), and is the stronger signal. Both appear as badges on candidate cards.

## Benefits, interviews, ATS and pay comparison

- **Benefits** (`/me/benefits`, managed in Admin → Benefits): the plans we offer temp workers (workers' comp, occupational accident, health, etc.), each marked active or planned, and the worker's average monthly hours against the ACA 130-hour full-time line. Plans come from the payroll/EOR partner; nothing is sold in-app.
- **Interviews**: from a candidate, the employer offers up to three times (in person, phone or video); the worker gets a text link, books one, and can add it to their calendar (`.ics`). Either side can cancel.
- **ATS webhooks** (Employer → Team, owner only): an https URL receives signed `candidate.sent`, `interview.booked` and `worker.hired` events (HMAC-SHA256 over `timestamp.body`, headers `X-CrewPass-Signature` and `X-CrewPass-Timestamp`). Payloads carry first name + last initial, trade and verified cards only. URLs are checked against private and internal addresses on every send, and redirects aren't followed.
- **Pay comparison** (`/pay`): median and middle range by trade within about 30 miles, from posted job pay and pay workers share anonymously; hidden until there are enough samples.

## Background checks and drug screens

- **Per job**: employers tick "Background check" / "Drug screen" when posting. The recruiter requests them from the job's pipeline once the employer wants to hire (sent or interview stage), and **Hired** stays locked until each is clear.
- **Authorization**: the worker gets a text and signs a standalone disclosure + authorization at `/me/screening` (manual mode), or on Checkr's hosted page (Checkr mode).
- **Providers**: manual by default (order in DISA/your lab's portal, record Clear or Flagged in **Recruiter → Screening**). Set `CHECKR_API_KEY`, `CHECKR_PACKAGE_BACKGROUND`, `CHECKR_PACKAGE_DRUG` and point a Checkr webhook at `/api/screening/checkr` to automate.
- **Privacy**: only outcome and dates are stored; reports stay with the provider. Employers see Clear / In progress / Under review / Not cleared. A result is reused only for the same employer (background 12 months, drug 30 days — estimates in `lib/screening/policy.ts`).
- **Flagged results**: clear after an individual review (note required), or send the pre-adverse notice (requires that a copy of the report and the FCRA Summary of Rights were sent), wait 5 business days, then the final notice.
- **Billing**: each order carries a price (defaults $65 background / $75 drug, estimates). **Recruiter → Screening → Create invoice** bills an employer's ordered screenings in one Stripe invoice.
- Have a lawyer review the disclosure wording and adverse-action process before ordering real checks.

## Pricing defaults

Placement fee defaults (estimates from the plan, editable per job): $3,000 helper/entry (including entry-level warehouse, mover, cleaning and landscaping roles), $4,000 mid, $5,000 journey-level. Temp work: markup on pay (default 45%). Due on day 30; free replacement if the hire leaves before day 90 (the job reopens automatically).

## Before real users — known gaps

- **Rate limits** (shared in Postgres): web signup 60 messages/10 min per browser and 300 per IP; SMS 40/10 min and calls 80/10 min per number; card uploads 20/hour per worker. Tune in the route files.
- **Card verification is manual.** I found no public NCCER API; recruiters check the registry, TDLR license search, etc. The review screen shows how for each card type.
- **Validity defaults marked `estimated`** in `lib/taxonomy.ts` (e.g. Basic Plus, H2S, AWS continuity) need checking against issuers.
- **Spanish voice recognition** quality is untested on real calls; test with real workers before relying on the phone line.
- **Legal review**: TCPA consent wording, data retention for card photos (PII), and FCRA (don't run background checks in-app).
- The skills list is a seed (5–15 per trade). The plan calls for 30–50 per trade.
- **Temp work needs a payroll/EOR partner, workers' comp and a staffing-firm review before the first shift.** The app computes pay; it does not withhold taxes or move money on its own. Texas Payday Law and the FLSA apply to CrewPass as the employer of record.
