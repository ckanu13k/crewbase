import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { requireCap, getLang } from "@/lib/session";
import { db, isDemo } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { integrations } from "@/lib/integrations";
import { SETTING_DEFS, getSettings, type SettingKey } from "@/lib/settings";
import { deleteDemoData, saveAppSettings } from "@/app/admin-actions";

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; demo?: string; n?: string }> }) {
  await requireCap("settings");
  const sp = await searchParams;
  const cfg = await getSettings();
  const settingRows = await (await db()).table("app_settings").list();
  const lang = await getLang();
  const store = await db();
  const [workers, employers, programs] = await Promise.all([store.table("workers").list(), store.table("employers").list(), store.table("training_programs").list()]);
  const demoWorkers = workers.filter((w) => /^w\d+$/.test(w.id)).length;
  const demoEmployers = employers.filter((e) => /^e\d+$/.test(e.id)).length;
  const samplePrograms = programs.filter((p) => p.sample).length;

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/settings" wide>
      <PageHeader eyebrow="Admin" title="Settings" subtitle={`Running in ${isDemo() ? "demo" : "live"} mode. Keys are never shown here — only whether each one is set.`} />
      <h2 className="h2 mb-2">Integrations</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Service</th><th>Status</th><th>What it turns on</th><th>Where to set it</th></tr></thead>
          <tbody>
            {integrations().map((i) => (
              <tr key={i.key} data-testid="integration">
                <td className="font-semibold">{i.name}</td>
                <td>{i.on === null ? <span className="flex items-center gap-1 text-slate-500"><HelpCircle size={15} /> check</span> : i.on ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={15} /> connected</span> : <span className="flex items-center gap-1 text-amber-700"><Circle size={15} /> not set</span>}</td>
                <td className="text-sm">{i.enables}</td>
                <td className="text-xs text-slate-500">{i.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={saveAppSettings} className="card" data-testid="settings-form">
          <h2 className="h2 mb-1">Business defaults</h2>
          <p className="mb-3 text-xs text-slate-500">Changes apply to new jobs, hires and screenings from now on. Every change is recorded in Activity.</p>
          {sp.saved && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Saved {sp.saved} change(s).</p>}
          <div className="space-y-2">
            {(Object.keys(SETTING_DEFS) as SettingKey[]).map((k) => {
              const d = SETTING_DEFS[k];
              const row = settingRows.find((r) => r.id === k);
              return (
                <label key={k} className="grid grid-cols-[1fr_7rem_5.5rem] items-center gap-2 text-sm">
                  <span>{d.label}{row && <span className="block text-xs text-slate-400">changed by {row.updatedBy}</span>}</span>
                  <input name={k} type="number" min={d.min} max={d.max} defaultValue={cfg[k]} className="input min-h-9 py-1 text-right" />
                  <span className="text-xs text-slate-500">{d.unit}{cfg[k] !== d.def ? ` · default ${d.def}` : ""}</span>
                </label>
              );
            })}
          </div>
          <button className="btn-primary mt-3 w-full">Save defaults</button>
        </form>
        <div className="card">
          <h2 className="h2 mb-2">Demo data</h2>
          <p className="text-sm">{demoWorkers} demo workers, {demoEmployers} demo employers and {samplePrograms} sample training programs are in this database.</p>
          {sp.demo === "deleted" && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Deleted {sp.n} demo rows.</p>}
          {sp.demo === "confirm" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Type DELETE DEMO DATA exactly to confirm.</p>}
          {isDemo() ? (
            <p className="mt-2 text-sm text-slate-600">Demo mode: use “Reset demo data” on the home page to start over.</p>
          ) : (
            <form action={deleteDemoData} className="mt-3 space-y-2">
              <p className="text-sm text-slate-600">Removes only the fictional rows (short ids like w1, e1, j1 and @example.com team members). Real accounts are never touched. <b>This can't be undone.</b></p>
              <input name="confirm" className="input" placeholder="Type DELETE DEMO DATA" autoComplete="off" />
              <button className="btn-ghost btn-sm text-red-700">Delete demo data</button>
            </form>
          )}
        </div>
      </div>
    </Shell>
  );
}
