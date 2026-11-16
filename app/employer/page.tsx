import Link from "next/link";
import { requireEmployer, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, employerNav } from "@/components/Shell";
import { tradeLabel } from "@/lib/taxonomy";
import { payText } from "@/components/CrewBadges";
import { rankCandidates } from "@/lib/matching";
import { getSettings } from "@/lib/settings";
import type { Credential, Job, Match } from "@/lib/types";

export default async function EmployerHome() {
  const s = await requireEmployer();
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const cfg = await getSettings();
  const [employer, jobs, workers, creds, matches] = await Promise.all([
    store.table("employers").get(s.employerId),
    store.table("jobs").list({ employerId: s.employerId } as Partial<Job>),
    store.table("workers").list(),
    store.table("credentials").list(),
    store.table("matches").list(),
  ]);
  const byWorker: Record<string, Credential[]> = {};
  for (const c of creds) (byWorker[c.workerId] ??= []).push(c);
  jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Shell lang={lang} nav={employerNav} back="/employer" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">{employer?.name}</h1>
          <p className="muted">Direct hire: flat fee due on the worker's day {cfg.feeDueDay}, free replacement within {cfg.guaranteeDays} days. Temp crews: hourly, one invoice a week.</p>
        </div>
        <Link href="/employer/jobs/new" className="btn-primary">Post a job</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Job</th><th>Start</th><th>Status</th><th>Workers who fit now</th><th>Sent to you</th><th>Interviews</th><th>Hired</th></tr></thead>
          <tbody>
            {jobs.map((j) => {
              const ms = matches.filter((m: Match) => m.jobId === j.id);
              const fit = rankCandidates(workers.filter((w) => w.onboardingComplete), byWorker, j, today).filter((r) => r.result.eligible).length;
              return (
                <tr key={j.id}>
                  <td><Link className="font-semibold text-brand hover:text-brand-dark" href={`/employer/jobs/${j.id}`}>{j.title}</Link><div className="muted">{tradeLabel(j.trade, "en")} · {payText(j)} · {j.headcount} opening(s) · {j.hireType === "temp" ? "temp crew" : "direct hire"}</div></td>
                  <td>{j.startDate}</td>
                  <td><span className={`pill ${j.status === "open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200"}`}>{j.status}</span></td>
                  <td>{fit}</td>
                  <td>{ms.filter((m) => ["sent", "interview", "hired"].includes(m.stage)).length}</td>
                  <td>{ms.filter((m) => m.stage === "interview").length}</td>
                  <td>{ms.filter((m) => m.stage === "hired").length}</td>
                </tr>
              );
            })}
            {jobs.length === 0 && <tr><td colSpan={7} className="muted">No jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
