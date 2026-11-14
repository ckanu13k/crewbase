import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { CREDENTIALS, SKILLS, TRADES, credShort } from "@/lib/taxonomy";
import { FUNDING_LABEL, money, sortPrograms } from "@/lib/training";
import { deleteProgram, saveProgram } from "@/app/actions";
import type { Funding } from "@/lib/types";

export default async function TrainingAdmin({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireRole("staff");
  const sp = await searchParams;
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const programs = sortPrograms(await store.table("training_programs").list(), today);
  const p = sp.edit ? programs.find((x) => x.id === sp.edit) : undefined;

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/training" wide>
      <h1 className="h1">Training directory</h1>
      <p className="muted mb-4">
        What workers see under Training and in “what you're missing”. Import the TWC ETPL with <code>npm run import:etpl</code>, then add start dates here for programs you refer people to.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Program</th><th>Next start</th><th>Cost</th><th>Covers</th><th></th></tr></thead>
            <tbody>
              {programs.length === 0 && <tr><td colSpan={5} className="muted">No programs yet.</td></tr>}
              {programs.map((x) => (
                <tr key={x.id} className={x.nextStart && x.nextStart < today ? "opacity-60" : ""}>
                  <td className="font-semibold">{x.name}<div className="muted">{x.provider} · {x.city}{x.sample ? " · sample" : ""}</div></td>
                  <td className={!x.nextStart || x.nextStart < today ? "text-amber-700" : ""}>{x.nextStart ?? "add date"}</td>
                  <td>{money(x.costUsd)}</td>
                  <td className="text-xs">{[...x.coversCredentials.map(credShort), ...(x.nccerLevel ? [`NCCER ${x.nccerLevel}`] : [])].join(", ") || "—"}{x.coversSkills.length ? ` +${x.coversSkills.length} skills` : ""}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/recruiter/training?edit=${x.id}`} className="btn-ghost btn-sm">Edit</Link>
                    <form action={deleteProgram} className="inline"><input type="hidden" name="id" value={x.id} /><button className="btn-sm text-stone-400 hover:text-red-600">✕</button></form>
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
            {p && <Link href="/recruiter/training" className="btn-ghost">Cancel</Link>}
          </div>
        </form>
      </div>
    </Shell>
  );
}
