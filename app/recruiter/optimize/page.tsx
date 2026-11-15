import Link from "next/link";
import { CheckCircle2, MapPin, XCircle } from "lucide-react";
import { requireRole, getLang } from "@/lib/session";
import { PageHeader, Shell, staffNav } from "@/components/Shell";
import { ScorePill } from "@/components/Badges";
import { buildPlan } from "@/lib/plan";
import { evaluateMatch } from "@/lib/matching";
import { pointOf, areaLabel, distanceMiles } from "@/lib/geo";
import { programCovers, gapText } from "@/lib/training";
import { tradeLabel } from "@/lib/taxonomy";
import { shortlistPlan } from "@/app/actions";
import type { Gap } from "@/lib/matching";

export default async function OptimizerPage() {
  await requireRole("staff");
  const lang = await getLang();
  const plan = await buildPlan();
  const { result: r, workers, jobs, employers, credsByWorker, today, matches, openings } = plan;
  const programs = await plan.store.table("training_programs").list();
  const shortlisted = new Set(matches.map((m) => `${m.jobId}:${m.workerId}`));
  const pending = r.assignments.filter((a) => !shortlisted.has(`${a.jobId}:${a.workerId}`)).length;
  const totalScore = r.assignments.reduce((a, x) => a + x.score, 0);
  const allOk = plan.checks.every((c) => c.ok);
  const place = (zip: string | null) => (zip ? areaLabel(zip) ?? zip : "—");

  // Why openings stay unfilled: most common blocker among same-trade workers within 50 miles.
  const unfilled = r.jobs.filter((j) => j.filled < j.open).map((js) => {
    const job = jobs[js.jobId];
    const counts = new Map<string, { gap: Gap; n: number }>();
    let nearby = 0;
    for (const w of Object.values(workers)) {
      if (w.trade !== job.trade || !w.onboardingComplete) continue;
      const miles = distanceMiles(w, job);
      if (miles !== null && miles > 50) continue;
      nearby++;
      const res = evaluateMatch(w, credsByWorker[w.id] ?? [], job, today);
      for (const g of res.gaps.filter((x) => x.blocking)) {
        const k = `${g.kind}:${g.credential ?? g.skill ?? g.need ?? ""}`;
        counts.set(k, { gap: g, n: (counts.get(k)?.n ?? 0) + 1 });
      }
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((x) => ({ ...x, program: programs.find((p) => programCovers(p, x.gap)) }));
    return { js, job, top, nearby };
  });

  // Map: project lat/lng into the SVG box.
  const pts = [...Object.values(jobs).map((j) => pointOf(j)), ...Object.values(workers).map((w) => pointOf(w))].filter((p): p is [number, number] => Boolean(p));
  const lat0 = Math.min(...pts.map((p) => p[0])) - 0.05, lat1 = Math.max(...pts.map((p) => p[0])) + 0.05;
  const lng0 = Math.min(...pts.map((p) => p[1])) - 0.05, lng1 = Math.max(...pts.map((p) => p[1])) + 0.05;
  const Wd = 720, Ht = 380;
  const xy = (p: [number, number]) => [((p[1] - lng0) / (lng1 - lng0)) * Wd, Ht - ((p[0] - lat0) / (lat1 - lat0)) * Ht] as const;
  const assigned = new Set(r.assignments.map((a) => a.workerId));
  const labeled: [number, number][] = [];
  const labelFor = (x: number, y: number) => {
    if (labeled.some(([a, b]) => Math.abs(a - x) < 70 && Math.abs(b - y) < 14)) return false;
    labeled.push([x, y]);
    return true;
  };

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/optimize" wide>
      <PageHeader
        eyebrow="Optimizer"
        title="Best crew plan"
        subtitle="Every open job solved together as one min-cost flow: fill the most openings first, then maximize match quality. Only pairs that pass every hard rule are considered."
        action={
          <form action={shortlistPlan}>
            <button className="btn-primary" disabled={pending === 0}>{pending ? `Shortlist all ${pending}` : "Plan shortlisted"}</button>
          </form>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { l: "Openings filled", v: `${r.stats.filled}/${r.stats.openings}`, s: `${Math.round(r.stats.fillRate * 100)}% of what's possible` },
          { l: "Avg match score", v: r.stats.avgScore, s: `total ${totalScore}` },
          { l: "Avg distance", v: r.stats.avgMiles === null ? "—" : `${r.stats.avgMiles} mi`, s: "worker to site" },
          { l: "Eligible pairs", v: r.stats.eligiblePairs, s: `${plan.poolSize} workers × ${r.stats.jobs} jobs` },
          { l: "Job-by-job ranking", v: `${r.greedy.filled} filled`, s: `total ${r.greedy.totalScore}` },
          { l: "Solve time", v: `${r.stats.ms} ms`, s: "rules + optimizer" },
        ].map((x) => (
          <div key={x.l} className="card" data-testid="opt-stat">
            <div className="muted">{x.l}</div>
            <div className="mt-1 text-2xl font-bold text-ink">{x.v}</div>
            <div className="text-xs text-slate-400">{x.s}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 pt-3">
            <h2 className="h2">Where the plan sends people</h2>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />Job site</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Assigned</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />Not placed</span>
            </div>
          </div>
          <svg viewBox={`-10 -10 ${Wd + 20} ${Ht + 20}`} className="h-auto w-full" role="img" aria-label="Map of workers and job sites">
            {r.assignments.map((a) => {
              const p = pointOf(workers[a.workerId]), q = pointOf(jobs[a.jobId]);
              if (!p || !q) return null;
              const [x1, y1] = xy(p), [x2, y2] = xy(q);
              return <line key={a.workerId} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#10b981" strokeOpacity={0.55} strokeWidth={1.5} />;
            })}
            {Object.values(workers).map((w) => {
              const p = pointOf(w);
              if (!p) return null;
              const [x, y] = xy(p);
              return <circle key={w.id} cx={x} cy={y} r={5} fill={assigned.has(w.id) ? "#10b981" : "#cbd5e1"} stroke="#fff" strokeWidth={1.5} />;
            })}
            {Object.values(jobs).map((j) => {
              const p = pointOf(j);
              if (!p) return null;
              const [x, y] = xy(p);
              return (
                <g key={j.id}>
                  <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
                  {labelFor(x, y) && (
                    <text x={x > Wd - 90 ? x - 9 : x + 9} y={y + 4} textAnchor={x > Wd - 90 ? "end" : "start"} fontSize={11} fill="#1e3a8a" fontWeight={600} stroke="#fff" strokeWidth={3} paintOrder="stroke">{place(j.zip)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="card">
          <h2 className="h2 mb-2 flex items-center gap-2">
            {allOk ? <CheckCircle2 className="text-emerald-600" size={20} /> : <XCircle className="text-red-600" size={20} />} Validation
          </h2>
          <p className="muted mb-3">Each assignment is re-checked from scratch against the rules engine.</p>
          <ul className="space-y-2 text-sm" data-testid="opt-checks">
            {plan.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                {c.ok ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} /> : <XCircle className="mt-0.5 shrink-0 text-red-600" size={16} />}
                <span className="flex-1">{c.label}<span className="block text-xs text-slate-400">{c.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">{plan.onAssignment} worker(s) currently on an assignment are left out.</p>
        </div>
      </div>

      <h2 className="h2 mt-6 mb-3">Assignments by job</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {r.jobs.filter((x) => x.open > 0).map((js) => {
          const job = jobs[js.jobId];
          const list = r.assignments.filter((a) => a.jobId === js.jobId);
          const todo = list.filter((a) => !shortlisted.has(`${a.jobId}:${a.workerId}`)).length;
          return (
            <div key={js.jobId} className="card" data-testid="opt-job">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/recruiter/jobs/${job.id}`} className="font-bold text-ink hover:underline">{job.title}</Link>
                  <div className="muted flex flex-wrap items-center gap-1">{employers[job.employerId]?.name} · <MapPin size={12} /> {place(job.zip)}</div>
                </div>
                <span className={`pill ${js.filled === js.open ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}>{js.filled}/{js.open} filled</span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {list.map((a) => (
                  <li key={a.workerId} className="flex items-center gap-3 py-2 text-sm">
                    <ScorePill score={a.score} eligible />
                    <div className="min-w-0 flex-1">
                      <Link href={`/recruiter/workers/${a.workerId}`} className="font-semibold hover:underline">{workers[a.workerId]?.name}</Link>
                      <div className="text-xs text-slate-500">{tradeLabel(workers[a.workerId]?.trade, "en")} · {place(workers[a.workerId]?.zip ?? null)}</div>
                    </div>
                    <span className="text-xs text-slate-500">{a.distanceMiles === null ? "—" : `${a.distanceMiles} mi`}</span>
                    {shortlisted.has(`${a.jobId}:${a.workerId}`) && <span className="pill bg-blue-50 text-blue-700">shortlisted</span>}
                  </li>
                ))}
                {list.length === 0 && <li className="py-2 text-sm text-slate-500">No one meets every requirement yet ({js.eligible} eligible).</li>}
              </ul>
              {todo > 0 && (
                <form action={shortlistPlan} className="mt-2">
                  <input type="hidden" name="jobId" value={job.id} />
                  <button className="btn-soft btn-sm">Shortlist {todo}</button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {unfilled.length > 0 && (
        <>
          <h2 className="h2 mt-6 mb-3">Openings the plan can't fill yet</h2>
          <div className="card overflow-x-auto">
            <table className="data">
              <thead><tr><th>Job</th><th>Open</th><th>Most common blocker nearby</th><th>Training that fixes it</th></tr></thead>
              <tbody>
                {unfilled.map(({ js, job, top, nearby }) => (
                  <tr key={job.id}>
                    <td className="font-semibold">{job.title}<div className="muted">{place(job.zip)}</div></td>
                    <td>{js.open - js.filled}</td>
                    <td className="text-sm">{top.length ? top.map((x) => <div key={x.gap.kind + (x.gap.credential ?? x.gap.skill ?? "")}>{gapText(x.gap, "en")} <span className="text-slate-400">({x.n} worker{x.n > 1 ? "s" : ""})</span></div>) : <span className="muted">{nearby ? `Every qualified ${tradeLabel(job.trade, "en").toLowerCase()} within 50 mi is already in the plan — recruit more` : `No ${tradeLabel(job.trade, "en").toLowerCase()}s within 50 mi yet — recruit in this area`}</span>}</td>
                    <td className="text-sm">{top.map((x) => x.program ? <div key={x.program.id + x.gap.kind}><Link href="/training" className="text-brand-dark underline">{x.program.name}</Link> <span className="text-slate-400">· {x.program.city}</span></div> : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="muted mt-6">
        {r.idleWorkerIds.length} worker(s) qualify somewhere but aren't needed right now; {r.unmatchableWorkerIds.length} don't meet the hard requirements of any open job.
      </p>
    </Shell>
  );
}
