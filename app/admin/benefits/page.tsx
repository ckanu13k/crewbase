import { requireCap, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { deleteBenefitPlan, saveBenefitPlan } from "@/app/crew-actions";
import { BENEFIT_KIND_LABEL } from "@/lib/benefits";
import type { BenefitKind, BenefitPlan } from "@/lib/types";

const KINDS = Object.keys(BENEFIT_KIND_LABEL) as BenefitKind[];

function PlanForm({ p }: { p?: BenefitPlan }) {
  return (
    <form action={saveBenefitPlan} className="grid gap-2 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input name="name" defaultValue={p?.name} placeholder="Plan name" className="input" required />
      <select name="kind" defaultValue={p?.kind ?? "health"} className="input">{KINDS.map((k) => <option key={k} value={k}>{BENEFIT_KIND_LABEL[k].en}</option>)}</select>
      <input name="carrier" defaultValue={p?.carrier} placeholder="Carrier / provider" className="input" />
      <input name="workerCost" defaultValue={p?.workerCost} placeholder="Worker cost (e.g. $0, $25/week)" className="input" />
      <textarea name="eligibility" defaultValue={p?.eligibility} placeholder="Who qualifies and when (plain words, shown to workers)" className="input min-h-16 sm:col-span-2" />
      <input name="url" defaultValue={p?.url ?? ""} placeholder="https:// plan details (optional)" className="input" />
      <select name="status" defaultValue={p?.status ?? "planned"} className="input"><option value="active">Active — shown to workers</option><option value="planned">Planned — listed as coming</option></select>
      <button className="btn-soft btn-sm sm:col-span-2">{p ? "Save" : "Add plan"}</button>
    </form>
  );
}

export default async function AdminBenefits() {
  await requireCap("payroll");
  const lang = await getLang();
  const plans = await (await db()).table("benefit_plans").list();
  return (
    <Shell lang={lang} nav={adminNav} back="/admin/benefits" wide>
      <PageHeader title="Benefits for temp workers" subtitle="What workers see on their Benefits page. These apply while CrewPass is their employer (temp assignments)." />
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Texas doesn't require private employers to carry workers' compensation, but most plant owners and general contractors require it in their contracts — get it before the first temp assignment.</li>
        <li>Under the ACA, an employer with 50+ full-time-equivalent employees must offer coverage to people averaging 30+ hours a week (130 a month). Each worker's Benefits page tracks their monthly hours.</li>
        <li>Plan details here are shown to workers word for word; have the carrier or your broker check them.</li>
      </ul>
      <div className="space-y-3">
        {plans.map((p) => (
          <details key={p.id} className="card" data-testid="benefit-plan">
            <summary className="cursor-pointer font-semibold">{p.name} <span className="pill ml-1 bg-slate-100 text-slate-600">{p.status}</span> <span className="text-sm font-normal text-slate-500">{BENEFIT_KIND_LABEL[p.kind].en} · {p.workerCost}</span></summary>
            <div className="mt-3"><PlanForm p={p} /></div>
            <form action={deleteBenefitPlan} className="mt-2"><input type="hidden" name="id" value={p.id} /><button className="text-xs text-slate-400 hover:text-red-600">Delete plan</button></form>
          </details>
        ))}
        <div className="card"><h2 className="h2 mb-2">Add a plan</h2><PlanForm /></div>
      </div>
    </Shell>
  );
}
