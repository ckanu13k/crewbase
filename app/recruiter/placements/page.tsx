import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { money } from "@/lib/training";
import { updatePlacement } from "@/app/actions";
import type { PlacementStatus } from "@/lib/types";

const STYLE: Record<PlacementStatus, string> = {
  active: "bg-sky-100 text-sky-800", day30_confirmed: "bg-amber-100 text-amber-900", invoiced: "bg-violet-100 text-violet-800",
  paid: "bg-emerald-100 text-emerald-800", left_early: "bg-red-100 text-red-800", replaced: "bg-stone-200",
};

export default async function Placements() {
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [placements, workers, jobs, employers] = await Promise.all([
    store.table("placements").list(), store.table("workers").list(), store.table("jobs").list(), store.table("employers").list(),
  ]);
  const w = Object.fromEntries(workers.map((x) => [x.id, x]));
  const j = Object.fromEntries(jobs.map((x) => [x.id, x]));
  const e = Object.fromEntries(employers.map((x) => [x.id, x]));
  placements.sort((a, b) => a.day30Date.localeCompare(b.day30Date));
  const sum = (s: PlacementStatus[]) => money(placements.filter((p) => s.includes(p.status)).reduce((a, p) => a + p.fee, 0));
  const Btn = ({ id, action, label, primary }: { id: string; action: string; label: string; primary?: boolean }) => (
    <form action={updatePlacement}>
      <input type="hidden" name="placementId" value={id} />
      <input type="hidden" name="action" value={action} />
      <button className={`${primary ? "btn-primary" : "btn-ghost"} btn-sm`}>{label}</button>
    </form>
  );

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/placements" wide>
      <h1 className="h1">Placements</h1>
      <p className="muted mb-4">A placement counts when the worker is still employed on day 30. Invoice then (net 15). If they leave before day 90, the employer gets a free replacement and the job reopens.</p>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><div className="muted">Waiting for day 30</div><div className="text-xl font-bold">{sum(["active"])}</div></div>
        <div className="card"><div className="muted">Ready to invoice</div><div className="text-xl font-bold">{sum(["day30_confirmed"])}</div></div>
        <div className="card"><div className="muted">Invoiced</div><div className="text-xl font-bold">{sum(["invoiced"])}</div></div>
        <div className="card"><div className="muted">Paid</div><div className="text-xl font-bold">{sum(["paid"])}</div></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Job / employer</th><th>Start</th><th>Day 30</th><th>Guarantee ends</th><th>Fee</th><th>Status</th><th>Next step</th></tr></thead>
          <tbody>
            {placements.length === 0 && <tr><td colSpan={8} className="muted">No placements yet. Mark a candidate “Hired” from a job's pipeline.</td></tr>}
            {placements.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{w[p.workerId]?.name}</td>
                <td>{j[p.jobId]?.title}<div className="muted">{e[p.employerId]?.name}</div></td>
                <td>{p.startDate}</td>
                <td className={p.status === "active" && p.day30Date <= today ? "font-bold text-amber-700" : ""}>{p.day30Date}</td>
                <td>{p.guaranteeEndsOn}</td>
                <td>{money(p.fee)}</td>
                <td>
                  <span className={`pill ${STYLE[p.status]}`}>{p.status.replace("_", " ")}</span>
                  {p.invoiceId && <div className="mt-1 text-xs text-stone-500">{p.invoiceUrl ? <a href={p.invoiceUrl} className="underline" target="_blank" rel="noreferrer">{p.invoiceId}</a> : p.invoiceId}</div>}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {p.status === "active" && (p.day30Date <= today ? <Btn id={p.id} action="confirm" label="Still employed ✔" primary /> : <span className="muted">wait</span>)}
                    {p.status === "day30_confirmed" && <Btn id={p.id} action="invoice" label="Create invoice" primary />}
                    {p.status === "invoiced" && <Btn id={p.id} action="paid" label="Mark paid" primary />}
                    {["active", "day30_confirmed", "invoiced", "paid"].includes(p.status) && p.guaranteeEndsOn >= today && <Btn id={p.id} action="left" label="Left early" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted mt-2">{process.env.STRIPE_SECRET_KEY ? "Invoices are created and emailed through Stripe." : "Stripe isn't configured: invoices are simulated (demo_inv_…)."}</p>
    </Shell>
  );
}
