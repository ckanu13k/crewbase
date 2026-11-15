import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { requireCap, getLang } from "@/lib/session";
import { db, isDemo } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { integrations } from "@/lib/integrations";
import { money, REVIEW_EVERY_DAYS } from "@/lib/training";
import { ADVERSE_WAIT_BUSINESS_DAYS, DEFAULT_PRICE, VALID_DAYS } from "@/lib/screening/policy";
import { DEFAULT_MIN_SCORE } from "@/lib/plan";

export default async function Settings() {
  await requireCap("settings");
  const lang = await getLang();
  const store = await db();
  const [workers, employers, programs] = await Promise.all([store.table("workers").list(), store.table("employers").list(), store.table("training_programs").list()]);
  const demoWorkers = workers.filter((w) => /^w\d+$/.test(w.id)).length;
  const demoEmployers = employers.filter((e) => /^e\d+$/.test(e.id)).length;
  const samplePrograms = programs.filter((p) => p.sample).length;

  const defaults = [
    ["Placement fee", `${money(3000)} helper/entry · ${money(4000)} mid · ${money(5000)} journey-level (editable per job)`],
    ["Replacement guarantee", "90 days; fee due at day 30"],
    ["Screening prices", `${money(DEFAULT_PRICE.background)} background · ${money(DEFAULT_PRICE.drug)} drug (editable per order)`],
    ["Screening valid for", `${VALID_DAYS.background} days background · ${VALID_DAYS.drug} days drug, same employer only`],
    ["Adverse-action wait", `${ADVERSE_WAIT_BUSINESS_DAYS} business days`],
    ["Optimizer minimum score", String(DEFAULT_MIN_SCORE)],
    ["Training requirements check", `every ${REVIEW_EVERY_DAYS} days`],
  ];

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
        <div className="card">
          <h2 className="h2 mb-2">Business defaults</h2>
          <dl className="space-y-2 text-sm">
            {defaults.map(([k, v]) => <div key={k} className="grid grid-cols-[12rem_1fr] gap-2"><dt className="text-slate-500">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-slate-400">These are estimates set in code (lib/screening/policy.ts, lib/plan.ts, app/actions.ts). Ask Claude to change them.</p>
        </div>
        <div className="card">
          <h2 className="h2 mb-2">Demo data</h2>
          <p className="text-sm">{demoWorkers} demo workers, {demoEmployers} demo employers and {samplePrograms} sample training programs are in this database.</p>
          <p className="mt-2 text-sm text-slate-600">
            {isDemo()
              ? "Demo mode: use “Reset demo data” on the home page to start over."
              : "Before real launch, delete rows with ids w1–w25, e1–e6, j1–j11, m1–m4, s1–s3 and t1–t10 (they're fictional), then load real training programs."}
          </p>
        </div>
      </div>
    </Shell>
  );
}
