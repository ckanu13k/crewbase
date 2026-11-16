import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { jobCandidates } from "@/lib/queries";
import { Shell, staffNav } from "@/components/Shell";
import { ScorePill } from "@/components/Badges";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { gapText, money } from "@/lib/training";
import { markHired, setMatchStage, shortlist, textTopMatches, textWorkerAboutJob } from "@/app/actions";
import { requestScreenings } from "@/app/screening-actions";
import { getSettings, screeningPrice } from "@/lib/settings";
import { KIND_LABEL, employerLabel, hireGate, kindsToOrder, requiredKinds } from "@/lib/screening/policy";
import type { MatchStage, Worker } from "@/lib/types";
import type { MatchResult } from "@/lib/matching";
import { HireTypeBadge, ReliabilityPill, payText } from "@/components/CrewBadges";
import { crewSignals } from "@/lib/crewdata";
import { slotLabel } from "@/lib/interviews";
import { billRateFor } from "@/lib/payroll";
import type { Reliability } from "@/lib/reliability";

const STAGES: MatchStage[] = ["shortlisted", "sent", "interview", "hired", "rejected"];

export default async function RecruiterJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("staff");
  const lang = await getLang();
  const data = await jobCandidates(id);
  if (!data) notFound();
  const { job, employer, ranked, matches, screeningsByWorker, today } = data;
  const kinds = requiredKinds(job);
  const cfg = await getSettings();
  const matchByWorker = Object.fromEntries(matches.map((m) => [m.workerId, m]));
  const eligible = ranked.filter((r) => r.result.eligible);
  const sig = await crewSignals(ranked.map((r) => r.worker.id));
  const ivs = await data.store.table("interviews").list({ jobId: job.id } as never);
  const close = ranked.filter((r) => !r.result.eligible && r.result.gaps.filter((g) => g.blocking).length <= 2).slice(0, 8);

  return (
    <Shell lang={lang} nav={staffNav} back={`/recruiter/jobs/${id}`} wide>
      <Link href="/recruiter" className="muted">← Dashboard</Link>
      <div className="card mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{job.title}</h1>
          <p className="muted">{employer?.name} · {tradeLabel(job.trade, "en")} · {payText(job)} · {job.shift} · ZIP {job.zip} · starts {job.startDate}{job.endDate ? ` → ${job.endDate}` : ""} · {job.headcount} opening(s) · {job.hireType === "temp" ? `temp, bill ~$${billRateFor(job.payMin, cfg.tempMarkupPct)}/hr${job.perDiem ? `, per diem $${job.perDiem}/day` : ""}` : `fee ${money(job.placementFee)}`} · <b>{job.status}</b></p>
          <div className="mt-1"><HireTypeBadge job={job} /></div>
          {kinds.length > 0 && <p className="mt-1 text-sm"><b>Before day one:</b> {kinds.map((k) => KIND_LABEL[k].en).join(" + ")} · <Link href="/recruiter/screenings" className="text-brand underline">Screenings →</Link></p>}
          <p className="mt-1 text-sm"><b>Required:</b> {job.requiredCredentials.map((c) => credLabel(c, "en")).join(", ")}{job.minNccerLevel ? ` · NCCER ${job.minNccerLevel}+` : ""}{job.minYears ? ` · ${job.minYears}+ yrs` : ""} · <b>Skills:</b> {job.requiredSkills.map((s) => skillLabel(s, "en")).join(", ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link href={`/employer/jobs/${job.id}/edit`} className="btn-ghost btn-sm">Edit job</Link>
        <form action={textTopMatches} className="flex items-center gap-2">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="limit" value="10" />
          <button className="btn-primary btn-sm">Text top 10 eligible workers</button>
        </form>
        </div>
      </div>

      <h2 className="h2 mb-2 mt-6">Pipeline</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Score</th><th>Stage</th><th>Screening</th><th>Notes</th><th>Hire</th></tr></thead>
          <tbody>
            {matches.length === 0 && <tr><td colSpan={6} className="muted">Nobody shortlisted yet.</td></tr>}
            {matches.map((m) => {
              const w = data.workers.find((x) => x.id === m.workerId);
              const mine = screeningsByWorker[m.workerId] ?? [];
              const gate = hireGate(job, mine, today);
              const toOrder = kindsToOrder(job, mine, today);
              return (
                <tr key={m.id}>
                  <td><Link className="font-semibold text-brand hover:text-brand-dark" href={`/recruiter/workers/${m.workerId}`}>{w?.name}</Link><div className="muted">{w?.phone}</div><div className="mt-1"><ReliabilityPill r={sig.rel(m.workerId)} /></div>{ivs.find((i) => i.matchId === m.id && i.status !== "canceled") && <div className="mt-1 text-xs text-emerald-700" data-testid="pipeline-interview">Interview: {(() => { const i = ivs.find((x) => x.matchId === m.id && x.status !== "canceled")!; return i.chosenSlot ? slotLabel(i.chosenSlot) : `offered ${i.slots.length} time(s)`; })()}</div>}</td>
                  <td>{m.score}</td>
                  <td>
                    {m.stage === "hired" ? (
                      <span className="pill bg-emerald-600 text-white">hired</span>
                    ) : (
                      <form action={setMatchStage} className="flex gap-1" key={`${m.id}-${m.stage}`}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <select name="stage" defaultValue={m.stage} className="input min-h-9 py-1 text-sm">
                          {STAGES.filter((s) => s !== "hired").map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button className="btn-ghost btn-sm">Set</button>
                      </form>
                    )}
                  </td>
                  <td className="text-xs" data-testid="pipeline-screening">
                    {kinds.length === 0 ? <span className="text-slate-400">Not required</span> : (
                      <div className="space-y-1">
                        {gate.items.map((it) => (
                          <div key={it.kind}><b>{KIND_LABEL[it.kind].en}:</b> {it.screening ? employerLabel(it.screening) : "not started"}</div>
                        ))}
                        {toOrder.length > 0 && ["sent", "interview"].includes(m.stage) && (
                          <form action={requestScreenings} className="flex flex-wrap items-center gap-1 pt-1">
                            <input type="hidden" name="matchId" value={m.id} />
                            {toOrder.map((k) => <input key={k} type="hidden" name={`price_${k}`} value={screeningPrice(k, cfg)} />)}
                            <button className="btn-soft btn-sm">Request {toOrder.map((k) => KIND_LABEL[k].en.toLowerCase()).join(" + ")}</button>
                          </form>
                        )}
                        {gate.items.some((i) => i.state === "review") && <Link href="/recruiter/screenings" className="font-semibold text-amber-700 underline">Review needed →</Link>}
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap text-xs text-slate-600">{m.notes}</td>
                  <td>
                    {m.stage === "interview" && !gate.ok && <span className="text-xs text-slate-500">Hire unlocks when screening is clear</span>}
                    {m.stage === "interview" && gate.ok && (
                      <form action={markHired} className="flex flex-wrap gap-1" data-testid="hire-form">
                        <input type="hidden" name="matchId" value={m.id} />
                        <input type="date" name="startDate" defaultValue={job.startDate > today ? job.startDate : today} className="input min-h-9 py-1 text-sm" />
                        {job.hireType === "temp" && <input type="number" name="payRate" step="0.25" min={job.payMin} max={Math.max(job.payMax, job.payMin)} defaultValue={job.payMin} className="input min-h-9 w-24 py-1 text-sm" aria-label="Pay rate" title="Pay rate ($/hr)" />}
                        <button className="btn-primary btn-sm">{job.hireType === "temp" ? "Start assignment" : "Hired"}</button>
                      </form>
                    )}
                    {m.stage === "hired" && <Link href={job.hireType === "temp" ? "/recruiter/crews" : "/recruiter/placements"} className="text-sm font-semibold text-brand hover:text-brand-dark">{job.hireType === "temp" ? "Crew →" : "Placement →"}</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted mt-1">Setting a worker to <b>sent</b> shares them with the employer and texts the worker.</p>

      <h2 className="h2 mb-2 mt-6">Meets every requirement ({eligible.length})</h2>
      <CandidateTable rows={eligible} jobId={job.id} matchByWorker={matchByWorker} rel={sig.rel} />

      <h2 className="h2 mb-2 mt-6">Close — 1–2 blocking gaps ({close.length})</h2>
      <p className="muted mb-2">Good candidates for employer-sponsored training or a quick card renewal.</p>
      <CandidateTable rows={close} jobId={job.id} matchByWorker={matchByWorker} rel={sig.rel} />
    </Shell>
  );
}

function CandidateTable({ rows, jobId, matchByWorker, rel }: { rows: { worker: Worker; result: MatchResult }[]; jobId: string; matchByWorker: Record<string, unknown>; rel: (id: string) => Reliability }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data">
        <thead><tr><th>Worker</th><th>Score</th><th>Breakdown</th><th>Gaps</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="muted">None.</td></tr>}
          {rows.map(({ worker, result }) => (
            <tr key={worker.id}>
              <td>
                <Link className="font-semibold text-brand hover:text-brand-dark" href={`/recruiter/workers/${worker.id}`}>{worker.name}</Link>
                <div className="muted">{tradeLabel(worker.trade, "en")} · {worker.yearsExperience ?? "?"} yrs · NCCER {worker.nccerLevel || "—"} · {result.distanceMiles !== null ? `${Math.round(result.distanceMiles)} mi` : "?"} · {worker.lang.toUpperCase()}</div>
                <div className="mt-1"><ReliabilityPill r={rel(worker.id)} /></div>
              </td>
              <td><ScorePill score={result.score} eligible={result.eligible} /></td>
              <td className="text-xs text-slate-500">skills {result.breakdown.skills} · cards {result.breakdown.credentials} · pref {result.breakdown.preferred} · exp {result.breakdown.experience} · dist {result.breakdown.distance} · trade {result.breakdown.trade}</td>
              <td className="max-w-sm text-xs">
                {result.gaps.length === 0 ? "—" : result.gaps.map((g, i) => <div key={i} className={g.blocking ? "font-semibold text-red-700" : "text-slate-600"}>{g.blocking ? "⛔ " : "• "}{gapText(g, "en")}</div>)}
              </td>
              <td className="whitespace-nowrap">
                {matchByWorker[worker.id] ? (
                  <span className="pill bg-slate-100">in pipeline</span>
                ) : (
                  <div className="flex gap-1">
                    <form action={shortlist}>
                      <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="workerId" value={worker.id} /><input type="hidden" name="score" value={result.score} />
                      <button className="btn-primary btn-sm">Shortlist</button>
                    </form>
                    <form action={textWorkerAboutJob}>
                      <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="workerId" value={worker.id} />
                      <button className="btn-ghost btn-sm" title="Text the worker about this job">Text</button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
