import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { rankCandidates, credentialStatus } from "@/lib/matching";
import { tradeLabel } from "@/lib/taxonomy";
import { money } from "@/lib/training";
import type { Credential } from "@/lib/types";

export default async function Dashboard() {
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [workers, creds, jobs, matches, placements, employers] = await Promise.all([
    store.table("workers").list(), store.table("credentials").list(), store.table("jobs").list(),
    store.table("matches").list(), store.table("placements").list(), store.table("employers").list(),
  ]);
  const byWorker: Record<string, Credential[]> = {};
  for (const c of creds) (byWorker[c.workerId] ??= []).push(c);
  const empName = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  const active = workers.filter((w) => w.onboardingComplete);
  const withVerified = active.filter((w) => (byWorker[w.id] ?? []).some((c) => c.verification === "verified")).length;
  const review = creds.filter((c) => c.needsReview || c.verification === "document").length;
  const due = placements.filter((p) => p.status === "active" && p.day30Date <= today);
  const billed = placements.filter((p) => ["invoiced", "paid"].includes(p.status)).reduce((a, p) => a + p.fee, 0);
  const pipeline = placements.filter((p) => ["active", "day30_confirmed"].includes(p.status)).reduce((a, p) => a + p.fee, 0);
  const expiring = creds.filter((c) => credentialStatus(c, today) === "expiring").length;
  const open = jobs.filter((j) => j.status === "open").sort((a, b) => a.startDate.localeCompare(b.startDate));

  const kpis = [
    { label: "Workers signed up", value: active.length, sub: `${workers.length - active.length} mid-signup` },
    { label: "With a verified card", value: `${active.length ? Math.round((withVerified / active.length) * 100) : 0}%`, sub: "target ≥ 40%" },
    { label: "Cards to review", value: review, sub: `${expiring} expiring ≤ 60 days`, href: "/recruiter/review" },
    { label: "Placements", value: placements.length, sub: `${due.length} past day 30, not billed`, href: "/recruiter/placements" },
    { label: "Fees in pipeline", value: money(pipeline), sub: `${money(billed)} invoiced or paid` },
  ];

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Recruiter dashboard</h1>
        <div className="flex gap-2">
          <Link href="/onboard" className="btn-ghost btn-sm">SMS signup simulator</Link>
          <Link href="/employer/jobs/new" className="btn-primary btn-sm">New job</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => {
          const inner = (<><div className="muted">{k.label}</div><div className="text-2xl font-bold">{k.value}</div><div className="text-xs text-stone-500">{k.sub}</div></>);
          return k.href ? <Link key={k.label} href={k.href} className="card hover:shadow-md">{inner}</Link> : <div key={k.label} className="card">{inner}</div>;
        })}
      </div>

      {due.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          ⏰ {due.length} placement(s) reached day 30. <Link href="/recruiter/placements" className="underline">Confirm they're still on the job and invoice →</Link>
        </div>
      )}

      <h2 className="h2 mb-2 mt-6">Open jobs</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Job</th><th>Employer</th><th>Start</th><th>Fit now</th><th>Pipeline</th><th>Fee</th></tr></thead>
          <tbody>
            {open.map((j) => {
              const fit = rankCandidates(active, byWorker, j, today).filter((r) => r.result.eligible).length;
              const ms = matches.filter((m) => m.jobId === j.id);
              return (
                <tr key={j.id}>
                  <td><Link href={`/recruiter/jobs/${j.id}`} className="font-semibold underline">{j.title}</Link><div className="muted">{tradeLabel(j.trade, "en")} · {j.headcount} opening(s)</div></td>
                  <td>{empName[j.employerId]}</td>
                  <td>{j.startDate}</td>
                  <td><span className={`pill ${fit >= j.headcount * 3 ? "bg-emerald-100 text-emerald-800" : fit > 0 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{fit}</span></td>
                  <td className="text-xs">{["shortlisted", "sent", "interview", "hired"].map((st) => `${st}: ${ms.filter((m) => m.stage === st).length}`).join(" · ")}</td>
                  <td>{money(j.placementFee)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
