import Link from "next/link";
import { requireCap, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, adminNav } from "@/components/Shell";
import { CREDENTIALS, SKILLS, TRADES, credShort } from "@/lib/taxonomy";
import { getSettings } from "@/lib/settings";
import { FUNDING_LABEL, money, needsReview, programServesJob, sortPrograms, REVIEW_EVERY_DAYS } from "@/lib/training";
import { deleteProgram, saveProgram } from "@/app/actions";
import { createProvider, setProgramStatus } from "@/app/provider-actions";
import type { Funding } from "@/lib/types";

export default async function TrainingAdmin({ searchParams }: { searchParams: Promise<{ edit?: string; perr?: string }> }) {
  await requireCap("manageTraining");
  const sp = await searchParams;
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const cfg = await getSettings();
  const programs = sortPrograms(await store.table("training_programs").list(), today);
  const jobs = (await store.table("jobs").list()).filter((j) => j.status === "open");
  const demand = (x: (typeof programs)[number]) => jobs.filter((j) => programServesJob(x, j)).reduce((a, j) => a + j.headcount, 0);
  programs.sort((a, b) => demand(b) - demand(a));
  const p = sp.edit ? programs.find((x) => x.id === sp.edit) : undefined;
  const providers = await store.table("providers").list();
  const providerName = Object.fromEntries(providers.map((x) => [x.id, x.name]));
  const pending = programs.filter((x) => x.status === "pending");

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/training" wide>
      <h1 className="h1">Training directory</h1>
      <p className="muted mb-4">
        What workers see under Training and in “what you're missing”, ranked by how many open positions ask for what each program gives. When an employer or regulator changes a requirement, edit the program here: saving marks it reviewed today. Programs not reviewed in {cfg.trainingReviewDays} days are flagged.
      </p>
      {pending.length > 0 && (
        <div className="card mb-4" data-testid="pending-programs">
          <h2 className="h2 mb-2">Waiting for approval ({pending.length})</h2>
          {pending.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
              <span><b>{x.name}</b> <span className="muted">· {x.providerId ? providerName[x.providerId] : x.provider} · {x.city} · starts {x.nextStart ?? "—"} · {money(x.costUsd)}</span></span>
              <span className="flex gap-1">
                <Link href={`/admin/training?edit=${x.id}`} className="btn-ghost btn-sm">Check</Link>
                <form action={setProgramStatus}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="status" value="published" /><button className="btn-primary btn-sm">Approve</button></form>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Program</th><th>Openings</th><th>Next start</th><th>Cost</th><th>Covers</th><th>Reviewed</th><th></th></tr></thead>
            <tbody>
              {programs.length === 0 && <tr><td colSpan={7} className="muted">No programs yet.</td></tr>}
              {programs.map((x) => (
                <tr key={x.id} className={x.nextStart && x.nextStart < today ? "opacity-60" : ""}>
                  <td className="font-semibold">{x.name}{x.status === "pending" && <span className="pill ml-1 bg-amber-50 text-amber-800">pending</span>}<div className="muted">{x.provider} · {x.city}{x.sample ? " · sample" : ""}{x.providerId ? " · managed by provider" : ""}</div></td>
                  <td className="font-semibold">{demand(x)}</td>
                  <td className={!x.nextStart || x.nextStart < today ? "text-amber-700" : ""}>{x.nextStart ?? "add date"}</td>
                  <td>{money(x.costUsd)}</td>
                  <td className="text-xs">{[...x.coversCredentials.map(credShort), ...(x.nccerLevel ? [`NCCER ${x.nccerLevel}`] : [])].join(", ") || "—"}{x.coversSkills.length ? ` +${x.coversSkills.length} skills` : ""}</td>
                  <td className={`text-xs ${needsReview(x, today, cfg.trainingReviewDays) ? "font-semibold text-amber-700" : "text-slate-500"}`}>{x.reviewedOn ?? "never"}{needsReview(x, today, cfg.trainingReviewDays) ? " · review" : ""}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/training?edit=${x.id}`} className="btn-ghost btn-sm">Edit</Link>
                    <form action={deleteProgram} className="inline"><input type="hidden" name="id" value={x.id} /><button className="btn-sm text-slate-400 hover:text-red-600">✕</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={saveProgram} className="card space-y-3" key={p?.id ?? "new"}>
          <h2 className="h2">{p ? "Edit program" : "Add program"}</h2>
          {p && <input type="hidden" name="id" value={p.id} />}
          <input name="name" defaultValue={p?.name} placeholder="Program name" className="input" required />
          <input name="provider" defaultValue={p?.provider} placeholder="Provider" className="input" required />
          <div className="grid grid-cols-2 gap-2">
            <select name="trade" defaultValue={p?.trade ?? ""} className="input"><option value="">Any trade</option>{TRADES.map((t) => <option key={t.id} value={t.id}>{t.label.en}</option>)}</select>
            <select name="nccerLevel" defaultValue={p?.nccerLevel ?? ""} className="input"><option value="">No NCCER level</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Completes level {n}</option>)}</select>
            <input name="city" defaultValue={p?.city} placeholder="City" className="input" />
            <input name="zip" defaultValue={p?.zip} placeholder="ZIP" className="input" />
            <div><label className="label">Next start</label><input name="nextStart" type="date" defaultValue={p?.nextStart ?? ""} className="input" /></div>
            <div><label className="label">Cost ($)</label><input name="costUsd" type="number" defaultValue={p?.costUsd ?? ""} className="input" /></div>
            <div><label className="label">Weeks</label><input name="weeks" type="number" step="0.1" defaultValue={p?.weeks ?? ""} className="input" /></div>
            <div><label className="label">Clock hours</label><input name="clockHours" type="number" defaultValue={p?.clockHours ?? ""} className="input" /></div>
          </div>
          <input name="url" defaultValue={p?.url ?? ""} placeholder="Link (https://…)" className="input" />
          <div>
            <label className="label">What employers ask for now</label>
            <textarea name="requirementNote" defaultValue={p?.requirementNote ?? ""} rows={3} className="input" placeholder="e.g. Plants now want this card renewed every 12 months." />
            <p className="mt-1 text-xs text-slate-500">Shown to workers under the program. Saving marks the requirements as checked today.</p>
          </div>
          <fieldset><legend className="label">Ways to pay</legend><div className="flex flex-wrap gap-2 text-sm">
            {(Object.keys(FUNDING_LABEL) as Funding[]).map((f) => <label key={f} className="flex items-center gap-1"><input type="checkbox" name="funding" value={f} defaultChecked={p?.funding.includes(f)} />{FUNDING_LABEL[f].en}</label>)}
          </div></fieldset>
          <fieldset><legend className="label">Taught in</legend><div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" name="languages" value="en" defaultChecked={!p || p.languages.includes("en")} />English</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="languages" value="es" defaultChecked={p?.languages.includes("es")} />Spanish</label>
          </div></fieldset>
          <details><summary className="cursor-pointer text-sm font-semibold">Cards it gets you</summary><div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {CREDENTIALS.map((c) => <label key={c.id} className="flex items-center gap-1"><input type="checkbox" name="coversCredentials" value={c.id} defaultChecked={p?.coversCredentials.includes(c.id)} />{c.short}</label>)}
          </div></details>
          <details><summary className="cursor-pointer text-sm font-semibold">Skills it teaches</summary><div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {SKILLS.map((s) => <label key={s.id} className="flex items-center gap-1"><input type="checkbox" name="coversSkills" value={s.id} defaultChecked={p?.coversSkills.includes(s.id)} />{s.label.en}</label>)}
          </div></details>
          <div className="flex gap-2">
            <button className="btn-primary flex-1">{p ? "Save" : "Add program"}</button>
            {p && <Link href="/admin/training" className="btn-ghost">Cancel</Link>}
          </div>
        </form>
      </div>
      <div className="card mt-6" data-testid="providers">
        <h2 className="h2 mb-1">Training providers</h2>
        <p className="muted mb-3">A provider's contact email signs in to manage their own classes. New classes they add wait for approval here.</p>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <table className="data">
            <thead><tr><th>Provider</th><th>Signs in with</th><th>Classes</th></tr></thead>
            <tbody>
              {providers.length === 0 && <tr><td colSpan={3} className="muted">None yet.</td></tr>}
              {providers.map((x) => <tr key={x.id}><td className="font-semibold">{x.name}</td><td>{x.contactEmail}</td><td>{programs.filter((pr) => pr.providerId === x.id).length}</td></tr>)}
            </tbody>
          </table>
          <form action={createProvider} className="space-y-2">
            {sp.perr && <p className="text-sm text-amber-700">Name and a valid email are required.</p>}
            <input name="name" required placeholder="Provider name" className="input" />
            <input name="email" type="email" required placeholder="Contact email" className="input" />
            <input name="website" placeholder="Website (https://…)" className="input" />
            <button className="btn-primary w-full">Add provider</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
