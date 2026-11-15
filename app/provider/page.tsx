import Link from "next/link";
import { requireCap, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, providerNav } from "@/components/Shell";
import { CREDENTIALS, SKILLS, TRADES, credShort } from "@/lib/taxonomy";
import { FUNDING_LABEL, money, programCovers, programServesJob } from "@/lib/training";
import { evaluateMatch } from "@/lib/matching";
import { deleteProviderProgram, saveProviderProgram } from "@/app/provider-actions";
import type { Credential, Funding, TrainingProgram } from "@/lib/types";

export default async function ProviderHome({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string; submitted?: string }> }) {
  const s = await requireCap("manageOwnListings");
  const sp = await searchParams;
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [provider, programs, jobs, workers, creds] = await Promise.all([
    s.providerId ? store.table("providers").get(s.providerId) : null,
    store.table("training_programs").list(),
    store.table("jobs").list(),
    store.table("workers").list(),
    store.table("credentials").list(),
  ]);
  const mine = programs.filter((p) => p.providerId === s.providerId).sort((a, b) => a.name.localeCompare(b.name));
  const open = jobs.filter((j) => j.status === "open");
  const byWorker: Record<string, Credential[]> = {};
  for (const c of creds) (byWorker[c.workerId] ??= []).push(c);
  // Aggregate demand only — providers never see who the workers are.
  const gapsByWorker = workers.filter((w) => w.onboardingComplete).map((w) => open.filter((j) => j.trade === w.trade).flatMap((j) => evaluateMatch(w, byWorker[w.id] ?? [], j, today).gaps.filter((g) => g.blocking)));
  const demand = (p: TrainingProgram) => ({
    openings: open.filter((j) => programServesJob(p, j)).reduce((a, j) => a + j.headcount, 0),
    workers: gapsByWorker.filter((gaps) => gaps.some((g) => programCovers(p, g))).length,
  });
  const editing = sp.edit === "new" ? null : mine.find((p) => p.id === sp.edit) ?? null;
  const showForm = sp.edit === "new" || Boolean(editing);

  return (
    <Shell lang={lang} nav={providerNav} back="/provider" wide>
      <PageHeader
        eyebrow="Training provider"
        title={provider?.name ?? "Your classes"}
        subtitle="Keep your dates, prices and requirements current. Workers see your classes ranked by how many local jobs ask for what you teach."
        action={<Link href="/provider?edit=new" className="btn-primary btn-sm">Add a class</Link>}
      />
      {sp.saved && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Saved — live on the training page now.</div>}
      {sp.submitted && <div className="mb-3 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark ring-1 ring-blue-200">Submitted. Our team reviews new classes before they appear to workers.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-3">
          {mine.length === 0 && <p className="card muted">No classes yet. Add your first one.</p>}
          {mine.map((p) => {
            const d = demand(p);
            return (
              <div key={p.id} className="card" data-testid="provider-program">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{p.name} {p.status === "pending" && <span className="pill bg-amber-50 align-middle text-amber-800 ring-1 ring-amber-200">waiting for approval</span>}</div>
                    <div className="muted">{p.city ? `${p.city} · ` : ""}next start {p.nextStart ?? <b className="text-amber-700">add a date</b>} · {money(p.costUsd)}</div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/provider?edit=${p.id}`} className="btn-ghost btn-sm">Edit</Link>
                    <form action={deleteProviderProgram}><input type="hidden" name="id" value={p.id} /><button className="btn-sm text-slate-400 hover:text-red-600">Remove</button></form>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="pill bg-blue-50 text-blue-700 ring-1 ring-blue-200" data-testid="provider-demand">{d.openings} open positions ask for this</span>
                  <span className="pill bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{d.workers} workers are missing what you teach</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">{[...p.coversCredentials.map(credShort), ...(p.nccerLevel ? [`NCCER ${p.nccerLevel}`] : [])].join(" · ")}{p.coversSkills.length ? ` · ${p.coversSkills.length} skills` : ""}</div>
              </div>
            );
          })}
        </div>

        {showForm && (
          <form action={saveProviderProgram} className="card space-y-3" key={editing?.id ?? "new"} data-testid="provider-form">
            <h2 className="h2">{editing ? "Edit class" : "Add a class"}</h2>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input name="name" defaultValue={editing?.name} placeholder="Class name" className="input" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="trade" defaultValue={editing?.trade ?? ""} className="input"><option value="">Any trade</option>{TRADES.map((t) => <option key={t.id} value={t.id}>{t.label.en}</option>)}</select>
              <select name="nccerLevel" defaultValue={editing?.nccerLevel ?? ""} className="input"><option value="">No NCCER level</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Completes level {n}</option>)}</select>
              <input name="city" defaultValue={editing?.city} placeholder="City" className="input" />
              <input name="zip" defaultValue={editing?.zip} placeholder="ZIP" className="input" />
              <div><label className="label">Next start</label><input name="nextStart" type="date" defaultValue={editing?.nextStart ?? ""} className="input" /></div>
              <div><label className="label">Cost ($)</label><input name="costUsd" type="number" defaultValue={editing?.costUsd ?? ""} className="input" /></div>
              <div><label className="label">Weeks</label><input name="weeks" type="number" step="0.1" defaultValue={editing?.weeks ?? ""} className="input" /></div>
              <div><label className="label">Clock hours</label><input name="clockHours" type="number" defaultValue={editing?.clockHours ?? ""} className="input" /></div>
            </div>
            <input name="url" defaultValue={editing?.url ?? ""} placeholder="Sign-up link (https://…)" className="input" />
            <div>
              <label className="label">What employers ask for now</label>
              <textarea name="requirementNote" defaultValue={editing?.requirementNote ?? ""} rows={2} className="input" />
            </div>
            <fieldset><legend className="label">Ways to pay</legend><div className="flex flex-wrap gap-2 text-sm">
              {(Object.keys(FUNDING_LABEL) as Funding[]).map((f) => <label key={f} className="flex items-center gap-1"><input type="checkbox" name="funding" value={f} defaultChecked={editing?.funding.includes(f)} />{FUNDING_LABEL[f].en}</label>)}
            </div></fieldset>
            <fieldset><legend className="label">Taught in</legend><div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" name="languages" value="en" defaultChecked={!editing || editing.languages.includes("en")} />English</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="languages" value="es" defaultChecked={editing?.languages.includes("es")} />Spanish</label>
            </div></fieldset>
            <details open={!editing}><summary className="cursor-pointer text-sm font-semibold">Cards it gets you</summary><div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              {CREDENTIALS.map((c) => <label key={c.id} className="flex items-center gap-1"><input type="checkbox" name="coversCredentials" value={c.id} defaultChecked={editing?.coversCredentials.includes(c.id)} />{c.short}</label>)}
            </div></details>
            <details><summary className="cursor-pointer text-sm font-semibold">Skills it teaches</summary><div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              {SKILLS.map((x) => <label key={x.id} className="flex items-center gap-1"><input type="checkbox" name="coversSkills" value={x.id} defaultChecked={editing?.coversSkills.includes(x.id)} />{x.label.en}</label>)}
            </div></details>
            <div className="flex gap-2">
              <button className="btn-primary flex-1">{editing ? "Save" : "Submit for approval"}</button>
              <Link href="/provider" className="btn-ghost">Cancel</Link>
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}
