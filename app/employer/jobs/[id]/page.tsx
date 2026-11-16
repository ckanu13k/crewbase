import { notFound } from "next/navigation";
import { isStaffRole } from "@/lib/permissions";
import Link from "next/link";
import { CalendarDays, Download, UsersRound } from "lucide-react";
import { requireEmployer, getLang } from "@/lib/session";
import { jobCandidates } from "@/lib/queries";
import { Shell, employerNav } from "@/components/Shell";
import { ScorePill, VerificationBadge, ExpiryBadge } from "@/components/Badges";
import { HireTypeBadge, ReliabilityPill, TestBadges, payText } from "@/components/CrewBadges";
import { RateForm } from "@/components/RateForm";
import { credLabel, sectorLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { employerRespond, setJobStatus } from "@/app/actions";
import { endAssignment, offerToCrew } from "@/app/crew-actions";
import { cancelInterview, proposeInterview } from "@/app/hiring-actions";
import { findCredential } from "@/lib/matching";
import { employerLabel, hireGate, KIND_LABEL, requiredKinds } from "@/lib/screening/policy";
import { crewSignals } from "@/lib/crewdata";
import { modeLabel, slotLabel } from "@/lib/interviews";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { billRateFor } from "@/lib/payroll";
import type { Interview } from "@/lib/types";

export default async function EmployerJob({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; interview?: string; offered?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireEmployer();
  const lang = await getLang();
  const data = await jobCandidates(id);
  if (!data || (data.job.employerId !== s.employerId && !isStaffRole(s.role))) notFound();
  const { job, ranked, matches, credsByWorker, today, screeningsByWorker } = data;
  const store = await db();
  const [interviews, assignments, placements, roster, ratings, cfg] = await Promise.all([
    store.table("interviews").list({ jobId: job.id } as never),
    store.table("assignments").list({ jobId: job.id } as never),
    store.table("placements").list({ jobId: job.id } as never),
    store.table("crew_roster").list({ employerId: job.employerId } as never),
    store.table("ratings").list({ jobId: job.id } as never),
    getSettings(),
  ]);
  const sig = await crewSignals(matches.map((m) => m.workerId));
  const kinds = requiredKinds(job);
  const eligible = ranked.filter((r) => r.result.eligible);
  const sharedIds = new Set(matches.filter((m) => ["sent", "interview", "hired", "rejected"].includes(m.stage)).map((m) => m.workerId));
  const firstName = (n: string) => `${n.split(" ")[0]} ${n.split(" ")[1]?.[0] ?? ""}.`;
  const ivFor = (matchId: string): Interview | undefined => interviews.filter((i) => i.matchId === matchId && i.status !== "canceled").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const temp = job.hireType === "temp";
  const W = Object.fromEntries(data.workers.map((w) => [w.id, w]));
  const ratingFor = (k: { assignmentId?: string; placementId?: string }) => ratings.find((r) => (k.assignmentId && r.assignmentId === k.assignmentId) || (k.placementId && r.placementId === k.placementId));

  return (
    <Shell lang={lang} nav={employerNav} back={`/employer/jobs/${id}`} wide>
      <Link href="/employer" className="muted">← Jobs</Link>
      {sp.new && <div className="mt-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white">Posted. {eligible.length} worker(s) meet every requirement right now; a recruiter will confirm availability and send you a shortlist.</div>}
      {sp.interview && <div className="mt-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200" data-testid="interview-sent">Interview times sent. We texted the candidate a link to pick one; you'll get an email when they do.</div>}
      {sp.offered !== undefined && <div className="mt-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200" data-testid="crew-offered">Offered to {sp.offered} crew member(s). Anyone interested shows up below.</div>}
      {sp.err === "slots" && <div className="mt-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Pick at least one future time.</div>}
      <div className="card mt-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="h1">{job.title} {job.status !== "open" && <span className="pill bg-slate-100 align-middle text-slate-600">{job.status}</span>}</h1>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/employer/jobs/${job.id}/candidates`} className="btn-ghost btn-sm" data-testid="export-csv"><Download size={14} /> CSV</a>
            <Link href={`/employer/jobs/${job.id}/edit`} className="btn-ghost btn-sm" data-testid="edit-job">Edit</Link>
            <form action={setJobStatus}>
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value={job.status === "closed" ? "open" : "closed"} />
              <button className="btn-ghost btn-sm" data-testid="close-job">{job.status === "closed" ? "Reopen" : "Close job"}</button>
            </form>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2"><HireTypeBadge job={job} /><span className="pill bg-slate-100 text-slate-600">{sectorLabel(job.sector, "en")}</span>{job.workOrder && <span className="pill bg-slate-100 text-slate-600">PO/WO {job.workOrder}</span>}</div>
        <p className="muted mt-1">{tradeLabel(job.trade, "en")} · {payText(job)} · {job.shift} · ZIP {job.zip} · starts {job.startDate}{job.endDate ? ` → ${job.endDate}` : ""} · {job.headcount} opening(s) · {temp ? `billed ~$${billRateFor(job.payMin, cfg.tempMarkupPct)}/hr${job.perDiem ? ` + $${job.perDiem}/day per diem at cost` : ""}` : `fee $${job.placementFee.toLocaleString()} per hire`}</p>
        <p className="mt-2 text-sm"><b>Required:</b> {job.requiredCredentials.map((c) => credLabel(c, "en")).join(", ") || "—"}{job.minNccerLevel ? ` · NCCER ${job.minNccerLevel}+` : ""}{job.minYears ? ` · ${job.minYears}+ yrs` : ""}</p>
        <p className="text-sm"><b>Skills:</b> {job.requiredSkills.map((x) => skillLabel(x, "en")).join(", ") || "—"}</p>
        {kinds.length > 0 && <p className="text-sm"><b>Before day one:</b> {kinds.map((k) => KIND_LABEL[k].en).join(" + ")} <span className="text-slate-500">(you see the outcome only)</span></p>}
        {roster.length > 0 && job.status === "open" && (
          <form action={offerToCrew} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <UsersRound size={16} className="text-brand" />
            <span className="flex-1 text-sm">You have {roster.length} people on your crew list. Offer this job to them first?</span>
            <input type="hidden" name="jobId" value={job.id} />
            <button className="btn-soft btn-sm" data-testid="offer-crew">Offer to my crew</button>
          </form>
        )}
      </div>

      {(assignments.length > 0 || placements.length > 0) && (
        <>
          <h2 id="hired" className="h2 mb-2 mt-6 scroll-mt-20">{temp ? "On this job" : "Hired"}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((a) => (
              <div key={a.id} className="card" data-testid="assignment-card">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-bold">{firstName(W[a.workerId]?.name ?? "Worker")}</div><div className="muted">{a.startDate} → {a.endDate ?? "open-ended"} · ${a.payRate}/hr pay · ${a.billRate}/hr billed</div></div>
                  <span className={`pill ${a.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{a.status}</span>
                </div>
                <div className="mt-2"><ReliabilityPill r={sig.rel(a.workerId)} /></div>
                {a.status === "active" && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-600">End assignment</summary>
                    <form action={endAssignment} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <input type="date" name="endDate" defaultValue={today} className="input w-auto" />
                      <input name="reason" placeholder="Reason (job done, cut, etc.)" className="input flex-1" />
                      <button className="btn-ghost btn-sm">End</button>
                    </form>
                  </details>
                )}
                <RateForm assignmentId={a.id} existing={ratingFor({ assignmentId: a.id })} />
              </div>
            ))}
            {placements.map((p) => (
              <div key={p.id} className="card">
                <div className="font-bold">{firstName(W[p.workerId]?.name ?? "Worker")}</div>
                <div className="muted">Started {p.startDate} · direct hire</div>
                {p.startDate <= today && <RateForm placementId={p.id} existing={ratingFor({ placementId: p.id })} />}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="h2 mb-2 mt-6">Your shortlist</h2>
      <p className="muted mb-2">Candidates a recruiter has checked and sent you. Every card shows how it was verified.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {ranked.filter((r) => sharedIds.has(r.worker.id)).map(({ worker, result }) => {
          const m = matches.find((x) => x.workerId === worker.id)!;
          const iv = ivFor(m.id);
          return (
            <div key={worker.id} className="card" data-testid="shortlist-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{firstName(worker.name)}</div>
                  <div className="muted">{tradeLabel(worker.trade, "en")} · {worker.yearsExperience ?? "?"} yrs · NCCER {worker.nccerLevel || "—"} · {result.distanceMiles !== null ? `${Math.round(result.distanceMiles)} mi` : "distance n/a"} · {worker.lang === "es" ? "Spanish-first" : "English"}</div>
                </div>
                <ScorePill score={result.score} eligible={result.eligible} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1"><ReliabilityPill r={sig.rel(worker.id)} /></div>
              <div className="mt-1"><TestBadges best={sig.tests(worker.id)} /></div>
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="pill bg-slate-100">{m.stage}</span>
                {iv?.status === "booked" && iv.chosenSlot && (
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-700" data-testid="interview-booked-employer">
                    <CalendarDays size={15} /> {slotLabel(iv.chosenSlot)} · {modeLabel(iv.mode)}
                    <a href={`/api/interviews/${iv.id}/ics`} className="text-brand underline">Add to calendar</a>
                  </span>
                )}
                {iv?.status === "proposed" && <span className="text-sm text-slate-500" data-testid="interview-waiting">Waiting for them to pick: {iv.slots.map((x) => slotLabel(x)).join(" / ")}</span>}
                {iv && <form action={cancelInterview}><input type="hidden" name="interviewId" value={iv.id} /><button className="text-xs text-slate-400 hover:text-red-600">Cancel interview</button></form>}
                {m.stage === "sent" && <form action={employerRespond}><input type="hidden" name="matchId" value={m.id} /><input type="hidden" name="stage" value="rejected" /><button className="btn-ghost btn-sm">Pass</button></form>}
              </div>
              {(m.stage === "sent" || (m.stage === "interview" && !iv)) && (
                <details className="mt-2" open={m.stage === "sent"}>
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Request an interview</summary>
                  <form action={proposeInterview} className="mt-2 space-y-2" data-testid="propose-interview">
                    <input type="hidden" name="matchId" value={m.id} />
                    <p className="text-xs text-slate-500">Offer up to 3 times (Central). They pick one by text.</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[0, 1, 2].map((i) => <input key={i} type="datetime-local" name="slot" className="input text-sm" required={i === 0} aria-label={`Time ${i + 1}`} />)}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                      <select name="mode" className="input text-sm" defaultValue="in_person"><option value="in_person">In person</option><option value="phone">Phone</option><option value="video">Video</option></select>
                      <input name="location" placeholder="Address, gate, or call-in details" className="input text-sm" />
                    </div>
                    <button className="btn-primary btn-sm">Send times</button>
                  </form>
                </details>
              )}
            </div>
          );
        })}
        {sharedIds.size === 0 && <p className="card muted md:col-span-2">No candidates sent yet. {eligible.length} worker(s) currently meet every requirement.</p>}
      </div>
    </Shell>
  );
}
