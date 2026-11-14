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
