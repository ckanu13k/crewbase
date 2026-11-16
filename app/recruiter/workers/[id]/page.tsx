import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { ExpiryBadge, ScorePill, VerificationBadge } from "@/components/Badges";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { evaluateMatch } from "@/lib/matching";
import { shiftLabel } from "@/lib/training";
import type { Credential, Job, Match, OnboardingSession } from "@/lib/types";
import { ReliabilityPill, TestBadges } from "@/components/CrewBadges";
import { crewSignals } from "@/lib/crewdata";
import { ASSESSMENTS, ASSESSMENT_BY_ID } from "@/lib/assessments";
import { recordHandsOn } from "@/app/hiring-actions";
import { setPayrollStatus } from "@/app/crew-actions";

export default async function WorkerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const w = await store.table("workers").get(id);
  if (!w) notFound();
  const [creds, jobs, matches, sessions] = await Promise.all([
    store.table("credentials").list({ workerId: id } as Partial<Credential>),
    store.table("jobs").list({ status: "open" } as Partial<Job>),
    store.table("matches").list({ workerId: id } as Partial<Match>),
    store.table("onboarding_sessions").list({ workerId: id } as Partial<OnboardingSession>),
  ]);
  const sig = await crewSignals([id]);
  const attempts = (await store.table("assessment_attempts").list({ workerId: id } as never)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const ratings = sig.ratings.filter((r) => r.workerId === id);
  const employers = Object.fromEntries((await store.table("employers").list()).map((e) => [e.id, e.name]));
  const evals = jobs.map((j) => ({ j, r: evaluateMatch(w, creds, j, today) })).sort((a, b) => Number(b.r.eligible) - Number(a.r.eligible) || b.r.score - a.r.score);

  return (
    <Shell lang={lang} nav={staffNav} back={`/recruiter/workers/${id}`} wide>
      <Link href="/recruiter/workers" className="muted">← Workers</Link>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div className="card">
          <h1 className="h1">{w.name}</h1>
          <p className="muted">{w.phone} · {w.lang === "es" ? "Spanish" : "English"} · {w.consentSms ? "SMS consent ✔" : "opted out"} · signed up via {sessions.map((s) => s.channel).join(", ") || "seed"}</p>
          <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
            <dt className="font-semibold">Trade</dt><dd>{tradeLabel(w.trade, "en")}</dd>
            <dt className="font-semibold">Experience</dt><dd>{w.yearsExperience ?? "?"} yrs · NCCER {w.nccerLevel || "—"}</dd>
            <dt className="font-semibold">ZIP / radius</dt><dd>{w.zip ?? "—"} / {w.radiusMiles ? `${w.radiusMiles} mi` : "any"}</dd>
            <dt className="font-semibold">Shifts</dt><dd>{w.shifts.map((s) => shiftLabel(s, "en")).join(", ")}</dd>
          </dl>
          <p className="mt-2 text-sm"><b>Skills:</b> {w.skills.map((s) => skillLabel(s, "en")).join(", ")}</p>
          <p className="mt-2 text-sm italic text-slate-600">“{w.summary}”</p>
        </div>
        <div className="card">
          <h2 className="h2 mb-2">Cards</h2>
          <div className="space-y-2">
            {creds.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-48 font-semibold">{credLabel(c.type, "en")}</span>
                <VerificationBadge c={c} lang="en" />
                <ExpiryBadge c={c} lang="en" today={today} />
                {c.verifiedMethod && <span className="text-xs text-slate-500">({c.verifiedMethod})</span>}
              </div>
            ))}
            {creds.length === 0 && <p className="muted">None.</p>}
          </div>
          <Link href="/recruiter/review" className="mt-3 inline-block text-sm underline">Review queue →</Link>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="card" data-testid="worker-track-record">
          <h2 className="h2 mb-2">Track record</h2>
          <ReliabilityPill r={sig.rel(id)} />
          <ul className="mt-2 space-y-1 text-sm">
            {ratings.map((r) => <li key={r.id}><b>{employers[r.employerId]}</b>: quality {r.quality}★, safety {r.safety}★, {r.rehire ? "would rehire" : "wouldn't rehire"}{r.comment ? ` — “${r.comment}”` : ""}</li>)}
            {ratings.length === 0 && <li className="muted">No employer ratings yet.</li>}
          </ul>
          <form action={setPayrollStatus} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="workerId" value={id} />
            <span className="font-semibold">Payroll paperwork</span>
            <select name="status" defaultValue={w.payrollStatus ?? "not_started"} className="input min-h-9 w-auto py-1 text-sm">
              <option value="not_started">Not started</option><option value="invited">Link sent</option><option value="ready">Done (W-4, I-9, deposit)</option>
            </select>
            <button className="btn-ghost btn-sm">Set</button>
            <span className="text-xs text-slate-500">Pay speed: {w.payoutSpeed ?? "weekly"}</span>
          </form>
        </div>
        <div className="card" data-testid="worker-tests">
          <h2 className="h2 mb-2">Skills tests</h2>
          <TestBadges best={sig.tests(id)} />
          <ul className="mt-2 space-y-1 text-sm">
            {attempts.filter((a) => a.completedAt).map((a) => <li key={a.id}>{ASSESSMENT_BY_ID[a.assessmentId]?.title.en}: {a.kind === "hands_on" ? `hands-on ${a.passed ? "pass" : "not yet"} by ${a.assessor}` : `${a.score}% in app${a.passed ? " (pass)" : ""}`} · {a.completedAt!.slice(0, 10)}{a.note ? ` — ${a.note}` : ""}</li>)}
            {attempts.length === 0 && <li className="muted">None yet.</li>}
          </ul>
          <form action={recordHandsOn} className="mt-3 space-y-2" data-testid="hands-on-form">
            <input type="hidden" name="workerId" value={id} />
            <div className="flex flex-wrap gap-2">
              <select name="assessmentId" className="input min-h-9 w-auto py-1 text-sm">{ASSESSMENTS.map((a) => <option key={a.id} value={a.id}>{a.title.en}</option>)}</select>
              <select name="result" className="input min-h-9 w-auto py-1 text-sm"><option value="pass">Pass</option><option value="fail">Not yet</option></select>
            </div>
            <input name="note" placeholder="What you watched them do" className="input min-h-9 py-1 text-sm" />
            <button className="btn-soft btn-sm">Record hands-on check</button>
          </form>
        </div>
      </div>
      <h2 className="h2 mb-2 mt-6">Open jobs for this worker</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Job</th><th>Score</th><th>Blocking gaps</th><th>Stage</th></tr></thead>
          <tbody>
            {evals.map(({ j, r }) => (
              <tr key={j.id}>
                <td><Link href={`/recruiter/jobs/${j.id}`} className="font-semibold text-brand hover:text-brand-dark">{j.title}</Link></td>
                <td><ScorePill score={r.score} eligible={r.eligible} /></td>
                <td className="text-xs">{r.gaps.filter((g) => g.blocking).map((g) => g.kind + (g.credential ? `: ${g.credential}` : "")).join(", ") || "—"}</td>
                <td>{matches.find((m) => m.jobId === j.id)?.stage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
