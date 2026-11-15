import { notFound } from "next/navigation";
import Link from "next/link";
import { requireEmployer, getLang } from "@/lib/session";
import { jobCandidates } from "@/lib/queries";
import { Shell, employerNav } from "@/components/Shell";
import { ScorePill, VerificationBadge, ExpiryBadge } from "@/components/Badges";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { employerRespond } from "@/app/actions";
import { findCredential } from "@/lib/matching";
import { employerLabel, hireGate, KIND_LABEL, requiredKinds } from "@/lib/screening/policy";

export default async function EmployerJob({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireEmployer();
  const lang = await getLang();
  const data = await jobCandidates(id);
  if (!data || (data.job.employerId !== s.employerId && s.role !== "staff")) notFound();
  const { job, ranked, matches, credsByWorker, today, screeningsByWorker } = data;
  const kinds = requiredKinds(job);
  const eligible = ranked.filter((r) => r.result.eligible);
  const sharedIds = new Set(matches.filter((m) => ["sent", "interview", "hired", "rejected"].includes(m.stage)).map((m) => m.workerId));
  const firstName = (n: string) => `${n.split(" ")[0]} ${n.split(" ")[1]?.[0] ?? ""}.`;

  return (
    <Shell lang={lang} nav={employerNav} back={`/employer/jobs/${id}`} wide>
      <Link href="/employer" className="muted">← Jobs</Link>
      {sp.new && <div className="mt-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Posted. {eligible.length} worker(s) meet every requirement right now; a recruiter will confirm availability and send you a shortlist.</div>}
      <div className="card mt-2">
        <h1 className="h1">{job.title}</h1>
        <p className="muted">{tradeLabel(job.trade, "en")} · ${job.payMin}–{job.payMax}/hr · {job.shift} · ZIP {job.zip} · starts {job.startDate} · {job.headcount} opening(s) · fee ${job.placementFee.toLocaleString()} per hire</p>
        <p className="mt-2 text-sm"><b>Required:</b> {job.requiredCredentials.map((c) => credLabel(c, "en")).join(", ") || "—"}{job.minNccerLevel ? ` · NCCER ${job.minNccerLevel}+` : ""}{job.minYears ? ` · ${job.minYears}+ yrs` : ""}</p>
        <p className="text-sm"><b>Skills:</b> {job.requiredSkills.map((x) => skillLabel(x, "en")).join(", ") || "—"}</p>
        {kinds.length > 0 && <p className="text-sm"><b>Before day one:</b> {kinds.map((k) => KIND_LABEL[k].en).join(" + ")} <span className="text-slate-500">(you see the outcome only)</span></p>}
      </div>

      <h2 className="h2 mb-2 mt-6">Your shortlist</h2>
      <p className="muted mb-2">Candidates a recruiter has checked and sent you. Every card shows how it was verified.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {ranked.filter((r) => sharedIds.has(r.worker.id)).map(({ worker, result }) => {
          const m = matches.find((x) => x.workerId === worker.id)!;
          return (
            <div key={worker.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{firstName(worker.name)}</div>
                  <div className="muted">{tradeLabel(worker.trade, "en")} · {worker.yearsExperience ?? "?"} yrs · NCCER {worker.nccerLevel || "—"} · {result.distanceMiles !== null ? `${Math.round(result.distanceMiles)} mi` : "distance n/a"} · {worker.lang === "es" ? "Spanish-first" : "English"}</div>
                </div>
                <ScorePill score={result.score} eligible={result.eligible} />
              </div>
              <div className="mt-2 space-y-1">
                {job.requiredCredentials.map((type) => {
                  const c = findCredential(credsByWorker[worker.id] ?? [], type, job.startDate);
                  return (
                    <div key={type} className="flex flex-wrap items-center gap-1 text-sm">
                      <span className="w-36 truncate">{credLabel(type, "en")}</span>
                      {c ? <><VerificationBadge c={c} lang="en" /><ExpiryBadge c={c} lang="en" today={today} /></> : <span className="pill bg-red-100 text-red-800">missing</span>}
                    </div>
                  );
                })}
              </div>
              {kinds.length > 0 && (
                <div className="mt-2 space-y-1">
                  {hireGate(job, screeningsByWorker[worker.id] ?? [], today).items.map((it) => (
                    <div key={it.kind} className="flex flex-wrap items-center gap-1 text-sm" data-testid="employer-screening">
                      <span className="w-36 truncate">{KIND_LABEL[it.kind].en}</span>
                      <span className={`pill ${it.state === "clear" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : it.state === "not_cleared" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                        {it.screening ? employerLabel(it.screening) : "Not started"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-sm text-slate-600">{worker.summary}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="pill bg-slate-100">{m.stage}</span>
                {m.stage === "sent" && (
                  <>
                    <form action={employerRespond}><input type="hidden" name="matchId" value={m.id} /><input type="hidden" name="stage" value="interview" /><button className="btn-primary btn-sm">Request interview</button></form>
                    <form action={employerRespond}><input type="hidden" name="matchId" value={m.id} /><input type="hidden" name="stage" value="rejected" /><button className="btn-ghost btn-sm">Pass</button></form>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {sharedIds.size === 0 && <p className="card muted md:col-span-2">No candidates sent yet. {eligible.length} worker(s) currently meet every requirement.</p>}
      </div>
    </Shell>
  );
}
