import Link from "next/link";
import { requireEmployer, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, employerNav } from "@/components/Shell";
import { ReliabilityPill, TestBadges } from "@/components/CrewBadges";
import { addToCrew, removeFromCrew } from "@/app/crew-actions";
import { crewSignals } from "@/lib/crewdata";
import { tradeLabel } from "@/lib/taxonomy";

export default async function EmployerCrew() {
  const s = await requireEmployer();
  const lang = await getLang();
  const store = await db();
  const by = { employerId: s.employerId } as never;
  const [employer, roster, assignments, placements, workers, jobs] = await Promise.all([
    store.table("employers").get(s.employerId), store.table("crew_roster").list(by), store.table("assignments").list(by), store.table("placements").list(by), store.table("workers").list(), store.table("jobs").list(by),
  ]);
  const W = Object.fromEntries(workers.map((w) => [w.id, w]));
  const short = (id: string) => { const n = W[id]?.name ?? "Worker"; return `${n.split(" ")[0]} ${n.split(" ")[1]?.[0] ?? ""}.`; };
  const onRoster = new Set(roster.map((c) => c.workerId));
  const pastIds = [...new Set([...assignments, ...placements].map((x) => x.workerId))].filter((id) => !onRoster.has(id) && W[id]);
  const sig = await crewSignals([...roster.map((c) => c.workerId), ...pastIds]);
  const busy = new Set((await store.table("assignments").list({ status: "active" } as never)).map((a) => a.workerId));
  const ratings = sig.ratings.filter((r) => r.employerId === s.employerId);
  const openJobs = jobs.filter((j) => j.status === "open");

  return (
    <Shell lang={lang} nav={employerNav} back="/employer/crew" wide>
      <PageHeader eyebrow={employer?.name} title="My crew" subtitle="People you'd hire again. Offer them a new job first from any open job's page." />
      <div className="grid gap-3 md:grid-cols-2">
        {roster.length === 0 && <p className="card muted md:col-span-2">No one yet. Rate someone after a job and tick “Add to my crew list”, or add them below.</p>}
        {roster.map((c) => {
          const mine = ratings.filter((r) => r.workerId === c.workerId);
          return (
            <div key={c.id} className="card" data-testid="crew-member">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold">{short(c.workerId)}</div>
                  <div className="muted">{tradeLabel(W[c.workerId]?.trade, "en")}{c.note ? ` · ${c.note}` : ""}</div>
                </div>
                <span className={`pill ${busy.has(c.workerId) ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{busy.has(c.workerId) ? "On a job now" : "Available"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1"><ReliabilityPill r={sig.rel(c.workerId)} /></div>
              <div className="mt-1"><TestBadges best={sig.tests(c.workerId)} /></div>
              {mine.length > 0 && <p className="mt-2 text-sm text-slate-600">Your ratings: {mine.map((r) => `${r.quality}★ quality, ${r.safety}★ safety${r.comment ? ` — “${r.comment}”` : ""}`).join(" · ")}</p>}
              <form action={removeFromCrew} className="mt-2"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-slate-400 hover:text-red-600">Remove from crew</button></form>
            </div>
          );
        })}
      </div>
      {pastIds.length > 0 && (
        <>
          <h2 className="h2 mb-2 mt-6">People who've worked for you</h2>
          <div className="card divide-y divide-slate-100 py-1">
            {pastIds.map((id) => (
              <form key={id} action={addToCrew} className="flex flex-wrap items-center gap-2 py-2">
                <input type="hidden" name="workerId" value={id} />
                <span className="w-32 font-semibold">{short(id)}</span>
                <span className="text-sm text-slate-500">{tradeLabel(W[id]?.trade, "en")}</span>
                <ReliabilityPill r={sig.rel(id)} />
                <input name="note" placeholder="Note (e.g. good lead)" className="input min-h-9 flex-1 py-1 text-sm" />
                <button className="btn-soft btn-sm">Add to crew</button>
              </form>
            ))}
          </div>
        </>
      )}
      {openJobs.length > 0 && roster.length > 0 && (
        <p className="mt-4 text-sm text-slate-600">Open jobs to offer them: {openJobs.map((j, i) => <span key={j.id}>{i > 0 && ", "}<Link href={`/employer/jobs/${j.id}`} className="font-semibold text-brand underline">{j.title}</Link></span>)}</p>
      )}
    </Shell>
  );
}
