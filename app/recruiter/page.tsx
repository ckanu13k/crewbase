import Link from "next/link";
import { Users, BadgeCheck, ClipboardCheck, HandCoins, DollarSign, AlertTriangle, MessageSquare, Plus } from "lucide-react";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, staffNav } from "@/components/Shell";
import { rankCandidates, credentialStatus } from "@/lib/matching";
import { tradeLabel } from "@/lib/taxonomy";
import { money } from "@/lib/training";
import type { Credential } from "@/lib/types";
import { generatedTodos, myEmployerIds } from "@/lib/todo";
import { ListTodo } from "lucide-react";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const session = await requireRole("staff");
  const sp = await searchParams;
  const mineIds = await myEmployerIds(session.memberId);
  const scopeAll = sp.scope === "all" || !mineIds;
  const todos = await generatedTodos(scopeAll ? null : mineIds);
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
  const open = jobs.filter((j) => j.status === "open" && (scopeAll || mineIds!.has(j.employerId))).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const kpis = [
    { label: "Workers signed up", value: active.length, sub: `${workers.length - active.length} mid-signup`, icon: Users, href: "/recruiter/workers" },
    { label: "With a verified card", value: `${active.length ? Math.round((withVerified / active.length) * 100) : 0}%`, sub: "target ≥ 40%", icon: BadgeCheck },
    { label: "Cards to review", value: review, sub: `${expiring} expiring ≤ 60 days`, href: "/recruiter/review", icon: ClipboardCheck },
    { label: "Placements", value: placements.length, sub: `${due.length} past day 30, not billed`, href: "/recruiter/placements", icon: HandCoins },
    { label: "Fees in pipeline", value: money(pipeline), sub: `${money(billed)} invoiced or paid`, icon: DollarSign },
  ];

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter" wide>
      <PageHeader
        eyebrow="Recruiter"
        title="Dashboard"
        subtitle="Signups, card reviews, open jobs and placement fees at a glance."
        action={
          <div className="flex gap-2">
            {mineIds && (
              <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
                <Link href="/recruiter" className={`rounded-md px-3 py-1 ${!scopeAll ? "bg-white shadow-sm" : "text-slate-500"}`}>My accounts</Link>
                <Link href="/recruiter?scope=all" className={`rounded-md px-3 py-1 ${scopeAll ? "bg-white shadow-sm" : "text-slate-500"}`}>All</Link>
              </div>
            )}
            <Link href="/recruiter/outbox" className="btn-ghost btn-sm"><MessageSquare size={16} /> Texts</Link>
            <Link href="/onboard" className="btn-ghost btn-sm">Signup simulator</Link>
            <Link href="/employer/jobs/new" className="btn-primary btn-sm"><Plus size={16} /> New job</Link>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => {
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">{k.label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"><k.icon size={16} /></span>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{k.value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{k.sub}</div>
            </>
          );
          return k.href ? <Link key={k.label} href={k.href} className="card card-hover">{inner}</Link> : <div key={k.label} className="card">{inner}</div>;
        })}
      </div>

      {todos.length > 0 && (
        <Link href={scopeAll ? "/recruiter/todo?scope=all" : "/recruiter/todo"} className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark ring-1 ring-blue-200 hover:bg-blue-100" data-testid="todo-banner">
          <ListTodo size={18} /> {todos.length} thing(s) on your to-do list{todos.some((t) => t.urgent) ? `, ${todos.filter((t) => t.urgent).length} urgent` : ""} →
        </Link>
      )}
      {due.length > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle size={18} /> {due.length} placement(s) reached day 30. <Link href="/recruiter/placements" className="underline">Confirm they're still on the job and invoice →</Link>
        </div>
      )}

      <h2 className="h2 mb-3 mt-8">Open jobs{!scopeAll ? " — my accounts" : ""}</h2>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="data">
          <thead><tr><th>Job</th><th>Employer</th><th>Start</th><th>Fit now</th><th>Pipeline</th><th>Fee</th></tr></thead>
          <tbody>
            {open.map((j) => {
              const fit = rankCandidates(active, byWorker, j, today).filter((r) => r.result.eligible).length;
              const ms = matches.filter((m) => m.jobId === j.id);
              return (
                <tr key={j.id}>
                  <td><Link href={`/recruiter/jobs/${j.id}`} className="font-semibold text-brand hover:text-brand-dark">{j.title}</Link><div className="muted">{tradeLabel(j.trade, "en")} · {j.headcount} opening(s)</div></td>
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
