import Link from "next/link";
import { AlertTriangle, BadgeCheck, Briefcase, DollarSign, HandCoins, Receipt, Users } from "lucide-react";
import { requireCap, getLang } from "@/lib/session";
import { db, isDemo, todayISO } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { money, needsReview } from "@/lib/training";
import { billable } from "@/lib/screening/policy";
import { integrations } from "@/lib/integrations";

export default async function AdminOverview() {
  await requireCap("settings");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [workers, creds, jobs, matches, placements, employers, screenings, programs, team] = await Promise.all([
    store.table("workers").list(), store.table("credentials").list(), store.table("jobs").list(), store.table("matches").list(),
    store.table("placements").list(), store.table("employers").list(), store.table("screenings").list(), store.table("training_programs").list(),
    store.table("team_members").list(),
  ]);

  const sumFees = (st: string[]) => placements.filter((p) => st.includes(p.status)).reduce((a, p) => a + p.fee, 0);
  const screeningBilled = screenings.filter((s) => s.invoiceId).reduce((a, s) => a + s.priceUsd, 0);
  const billed = sumFees(["invoiced", "paid"]) + screeningBilled;
  const collected = sumFees(["paid"]);
  const outstanding = sumFees(["invoiced"]);
  const pipeline = sumFees(["active", "day30_confirmed"]);
  const toBill = placements.filter((p) => p.status === "day30_confirmed").length + billable(screenings).length;

  const active = workers.filter((w) => w.onboardingComplete);
  const verifiedWorkers = new Set(creds.filter((c) => c.verification === "verified").map((c) => c.workerId));
  const relevantJobs = jobs.filter((j) => j.status !== "closed");
  const openings = relevantJobs.reduce((a, j) => a + j.headcount, 0);
  const hires = matches.filter((m) => m.stage === "hired").length;
  const stageCount = (st: string[]) => new Set(matches.filter((m) => st.includes(m.stage)).map((m) => `${m.jobId}:${m.workerId}`)).size;
  const funnel = [
    { label: "Workers signed up", n: active.length },
    { label: "With a verified card", n: active.filter((w) => verifiedWorkers.has(w.id)).length },
    { label: "Shortlisted (any stage)", n: matches.length },
    { label: "Sent to employers", n: stageCount(["sent", "interview", "hired"]) },
    { label: "Interviewed", n: stageCount(["interview", "hired"]) },
    { label: "Hired", n: hires },
  ];
  const max = Math.max(1, ...funnel.map((f) => f.n));

  const demoIds = new Set(["e1", "e2", "e3", "e4", "e5", "e6"]);
  const demoRows = employers.filter((e) => demoIds.has(e.id)).length;
  const missing = integrations().filter((i) => i.on === false);
  const attention = [
    { n: creds.filter((c) => c.needsReview || c.verification === "document").length, label: "cards waiting for review", href: "/recruiter/review" },
    { n: screenings.filter((s) => s.status === "needs_review" || s.status === "pre_adverse").length, label: "flagged screenings", href: "/recruiter/screenings" },
    { n: placements.filter((p) => p.status === "active" && p.day30Date <= today).length, label: "placements past day 30, not confirmed", href: "/recruiter/placements" },
    { n: toBill, label: "items ready to invoice", href: "/admin/billing" },
    { n: programs.filter((p) => needsReview(p, today)).length, label: "training programs due for a requirements check", href: "/admin/training" },
    { n: !isDemo() && demoRows ? demoRows : 0, label: "demo employers still in the live database", href: "/admin/settings" },
    { n: missing.length, label: "integrations not connected", href: "/admin/settings" },
  ].filter((a) => a.n > 0);

  const kpis = [
    { label: "Billed to date", value: money(billed), sub: `${money(collected)} collected`, icon: Receipt },
    { label: "Outstanding", value: money(outstanding), sub: "invoiced, not paid", icon: DollarSign },
    { label: "Fees in pipeline", value: money(pipeline), sub: "hired, before invoice", icon: HandCoins },
    { label: "Fill rate", value: openings ? `${Math.round((hires / openings) * 100)}%` : "—", sub: `${hires} hires / ${openings} openings`, icon: Briefcase },
    { label: "Workers", value: active.length, sub: `${active.length ? Math.round((funnel[1].n / active.length) * 100) : 0}% verified`, icon: Users },
    { label: "Team", value: team.length, sub: `${team.filter((t) => t.role === "recruiter").length} recruiters`, icon: BadgeCheck },
  ];

  const byEmployer = employers
    .map((e) => ({
      e,
      hires: placements.filter((p) => p.employerId === e.id).length,
      fees: placements.filter((p) => p.employerId === e.id && ["invoiced", "paid"].includes(p.status)).reduce((a, p) => a + p.fee, 0),
      open: jobs.filter((j) => j.employerId === e.id && j.status === "open").length,
    }))
    .sort((a, b) => b.fees - a.fees || b.hires - a.hires || b.open - a.open)
    .slice(0, 6);

  return (
    <Shell lang={lang} nav={adminNav} back="/admin" wide>
      <PageHeader eyebrow="Admin" title="Business overview" subtitle="Revenue, hiring funnel and what needs attention across the whole app." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="card" data-testid="admin-kpi">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{k.label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"><k.icon size={16} /></span>
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{k.value}</div>
            <div className="text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Hiring funnel</h2>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.label} className="grid grid-cols-[11rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="text-slate-600">{f.label}</span>
                <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-brand" style={{ width: `${(f.n / max) * 100}%` }} /></div>
                <span className="text-right font-semibold">{f.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="h2 mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600" /> Needs attention</h2>
          {attention.length === 0 ? <p className="muted">Nothing waiting.</p> : (
            <ul className="divide-y divide-slate-100" data-testid="admin-attention">
              {attention.map((a) => (
                <li key={a.label}><Link href={a.href} className="flex items-center justify-between py-2 text-sm hover:text-brand"><span>{a.label}</span><span className="pill bg-amber-50 text-amber-800 ring-1 ring-amber-200">{a.n}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h2 className="h2 mb-2">Employers</h2>
        <table className="data">
          <thead><tr><th>Company</th><th>Open jobs</th><th>Hires</th><th>Fees billed</th></tr></thead>
          <tbody>
            {byEmployer.map(({ e, hires: h, fees, open }) => (
              <tr key={e.id}><td className="font-semibold">{e.name}</td><td>{open}</td><td>{h}</td><td>{money(fees)}</td></tr>
            ))}
          </tbody>
        </table>
        <Link href="/admin/employers" className="mt-2 inline-block text-sm font-semibold text-brand">All employers →</Link>
      </div>
    </Shell>
  );
}
