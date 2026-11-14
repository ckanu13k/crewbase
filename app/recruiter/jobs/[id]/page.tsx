import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { jobCandidates } from "@/lib/queries";
import { Shell, staffNav } from "@/components/Shell";
import { ScorePill } from "@/components/Badges";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { gapText, money } from "@/lib/training";
import { markHired, setMatchStage, shortlist, textTopMatches, textWorkerAboutJob } from "@/app/actions";
import type { MatchStage, Worker } from "@/lib/types";
import type { MatchResult } from "@/lib/matching";

const STAGES: MatchStage[] = ["shortlisted", "sent", "interview", "hired", "rejected"];

export default async function RecruiterJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("staff");
  const lang = await getLang();
  const data = await jobCandidates(id);
  if (!data) notFound();
  const { job, employer, ranked, matches } = data;
  const matchByWorker = Object.fromEntries(matches.map((m) => [m.workerId, m]));
  const eligible = ranked.filter((r) => r.result.eligible);
  const close = ranked.filter((r) => !r.result.eligible && r.result.gaps.filter((g) => g.blocking).length <= 2).slice(0, 8);

  return (
    <Shell lang={lang} nav={staffNav} back={`/recruiter/jobs/${id}`} wide>
      <Link href="/recruiter" className="muted">← Dashboard</Link>
      <div className="card mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{job.title}</h1>
          <p className="muted">{employer?.name} · {tradeLabel(job.trade, "en")} · ${job.payMin}–{job.payMax}/hr · {job.shift} · ZIP {job.zip} · starts {job.startDate} · {job.headcount} opening(s) · fee {money(job.placementFee)} · <b>{job.status}</b></p>
          <p className="mt-1 text-sm"><b>Required:</b> {job.requiredCredentials.map((c) => credLabel(c, "en")).join(", ")}{job.minNccerLevel ? ` · NCCER ${job.minNccerLevel}+` : ""}{job.minYears ? ` · ${job.minYears}+ yrs` : ""} · <b>Skills:</b> {job.requiredSkills.map((s) => skillLabel(s, "en")).join(", ")}</p>
        </div>
        <form action={textTopMatches} className="flex items-center gap-2">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="limit" value="10" />
          <button className="btn-dark btn-sm">Text top 10 eligible workers</button>
        </form>
      </div>

      <h2 className="h2 mb-2 mt-6">Pipeline</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Score</th><th>Stage</th><th>Notes</th><th>Hire</th></tr></thead>
          <tbody>
            {matches.length === 0 && <tr><td colSpan={5} className="muted">Nobody shortlisted yet.</td></tr>}
            {matches.map((m) => {
              const w = data.workers.find((x) => x.id === m.workerId);
              return (
                <tr key={m.id}>
                  <td><Link className="font-semibold underline" href={`/recruiter/workers/${m.workerId}`}>{w?.name}</Link><div className="muted">{w?.phone}</div></td>
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
                  <td className="max-w-xs whitespace-pre-wrap text-xs text-stone-600">{m.notes}</td>
                  <td>
                    {m.stage === "interview" && (
                      <form action={markHired} className="flex gap-1">
                        <input type="hidden" name="matchId" value={m.id} />
                        <input type="date" name="startDate" defaultValue={job.startDate} className="input min-h-9 py-1 text-sm" />
                        <button className="btn-primary btn-sm">Hired</button>
                      </form>
                    )}
                    {m.stage === "hired" && <Link href="/recruiter/placements" className="text-sm underline">Placement →</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted mt-1">Setting a worker to <b>sent</b> shares them with the employer and texts the worker.</p>

      <h2 className="h2 mb-2 mt-6">Meets every requirement ({eligible.length})</h2>
      <CandidateTable rows={eligible} jobId={job.id} matchByWorker={matchByWorker} />

      <h2 className="h2 mb-2 mt-6">Close — 1–2 blocking gaps ({close.length})</h2>
      <p className="muted mb-2">Good candidates for employer-sponsored training or a quick card renewal.</p>
      <CandidateTable rows={close} jobId={job.id} matchByWorker={matchByWorker} />
    </Shell>
  );
}

function CandidateTable({ rows, jobId, matchByWorker }: { rows: { worker: Worker; result: MatchResult }[]; jobId: string; matchByWorker: Record<string, unknown> }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data">
        <thead><tr><th>Worker</th><th>Score</th><th>Breakdown</th><th>Gaps</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="muted">None.</td></tr>}
          {rows.map(({ worker, result }) => (
            <tr key={worker.id}>
              <td>
                <Link className="font-semibold underline" href={`/recruiter/workers/${worker.id}`}>{worker.name}</Link>
                <div className="muted">{tradeLabel(worker.trade, "en")} · {worker.yearsExperience ?? "?"} yrs · NCCER {worker.nccerLevel || "—"} · {result.distanceMiles !== null ? `${Math.round(result.distanceMiles)} mi` : "?"} · {worker.lang.toUpperCase()}</div>
              </td>
              <td><ScorePill score={result.score} eligible={result.eligible} /></td>
              <td className="text-xs text-stone-500">skills {result.breakdown.skills} · cards {result.breakdown.credentials} · pref {result.breakdown.preferred} · exp {result.breakdown.experience} · dist {result.breakdown.distance} · trade {result.breakdown.trade}</td>
              <td className="max-w-sm text-xs">
                {result.gaps.length === 0 ? "—" : result.gaps.map((g, i) => <div key={i} className={g.blocking ? "font-semibold text-red-700" : "text-stone-600"}>{g.blocking ? "⛔ " : "• "}{gapText(g, "en")}</div>)}
              </td>
              <td className="whitespace-nowrap">
                {matchByWorker[worker.id] ? (
                  <span className="pill bg-stone-100">in pipeline</span>
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
