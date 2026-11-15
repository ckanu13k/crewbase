import { requireCap, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { money } from "@/lib/training";
import { updatePlacement } from "@/app/actions";
import { invoiceEmployerScreenings } from "@/app/screening-actions";
import { KIND_LABEL, billable } from "@/lib/screening/policy";

export default async function Billing() {
  await requireCap("bill");
  const lang = await getLang();
  const store = await db();
  const [placements, screenings, workers, jobs, employers] = await Promise.all([
    store.table("placements").list(), store.table("screenings").list(), store.table("workers").list(), store.table("jobs").list(), store.table("employers").list(),
  ]);
  const W = Object.fromEntries(workers.map((x) => [x.id, x.name]));
  const J = Object.fromEntries(jobs.map((x) => [x.id, x.title]));
  const E = Object.fromEntries(employers.map((x) => [x.id, x.name]));
  const ready = placements.filter((p) => p.status === "day30_confirmed");
  const invoiced = placements.filter((p) => p.status === "invoiced");
  const paid = placements.filter((p) => p.status === "paid");
  const owed = employers.map((e) => ({ e, rows: billable(screenings.filter((s) => s.employerId === e.id)) })).filter((x) => x.rows.length);
  const screeningInvoices = Object.values(
    screenings.filter((s) => s.invoiceId).reduce<Record<string, { id: string; employerId: string; total: number; n: number }>>((acc, s) => {
      const k = s.invoiceId!;
      acc[k] ??= { id: k, employerId: s.employerId, total: 0, n: 0 };
      acc[k].total += s.priceUsd; acc[k].n += 1;
      return acc;
    }, {}),
  );
  const sum = (xs: { fee: number }[]) => money(xs.reduce((a, p) => a + p.fee, 0));
  const Act = ({ id, action, label }: { id: string; action: string; label: string }) => (
    <form action={updatePlacement}><input type="hidden" name="placementId" value={id} /><input type="hidden" name="action" value={action} /><button className="btn-primary btn-sm">{label}</button></form>
  );

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/billing" wide>
      <PageHeader eyebrow="Admin" title="Billing" subtitle={process.env.STRIPE_SECRET_KEY ? "Invoices are created and emailed through Stripe (net 15)." : "Stripe isn't connected: invoices are simulated until STRIPE_SECRET_KEY is set."} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><div className="muted">Ready to invoice</div><div className="text-xl font-bold">{sum(ready)}</div></div>
        <div className="card"><div className="muted">Screenings to bill</div><div className="text-xl font-bold">{money(owed.reduce((a, x) => a + x.rows.reduce((b, r) => b + r.priceUsd, 0), 0))}</div></div>
        <div className="card"><div className="muted">Outstanding</div><div className="text-xl font-bold">{sum(invoiced)}</div></div>
        <div className="card"><div className="muted">Collected</div><div className="text-xl font-bold">{sum(paid)}</div></div>
      </div>

      <h2 className="h2 mb-2">Placement fees</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Job / employer</th><th>Day 30</th><th>Fee</th><th>Invoice</th><th></th></tr></thead>
          <tbody>
            {[...ready, ...invoiced, ...paid].length === 0 && <tr><td colSpan={6} className="muted">Nothing to bill yet. Placements appear here once a recruiter confirms day 30.</td></tr>}
            {[...ready, ...invoiced, ...paid].map((p) => (
              <tr key={p.id} data-testid="billing-placement">
                <td className="font-semibold">{W[p.workerId]}</td>
                <td>{J[p.jobId]}<div className="muted">{E[p.employerId]}</div></td>
                <td>{p.day30Date}</td>
                <td>{money(p.fee)}</td>
                <td className="text-xs">{p.invoiceId ? (p.invoiceUrl ? <a className="underline" href={p.invoiceUrl} target="_blank" rel="noreferrer">{p.invoiceId}</a> : p.invoiceId) : "—"}<div className="text-slate-400">{p.status.replace("_", " ")}</div></td>
                <td>{p.status === "day30_confirmed" ? <Act id={p.id} action="invoice" label="Create invoice" /> : p.status === "invoiced" ? <Act id={p.id} action="paid" label="Mark paid" /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h2 mb-2">Screenings</h2>
      <div className="card mb-3 space-y-2">
        {owed.length === 0 && <p className="muted">No screenings waiting to be billed.</p>}
        {owed.map(({ e, rows }) => (
          <form key={e.id} action={invoiceEmployerScreenings} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0" data-testid="screening-bill">
            <input type="hidden" name="employerId" value={e.id} />
            <span>
              <b>{e.name}</b> · {rows.length} screening(s) · <b>{money(rows.reduce((a, x) => a + x.priceUsd, 0))}</b>
              <span className="block text-xs text-slate-500">{rows.map((r) => `${KIND_LABEL[r.kind].en} — ${W[r.workerId]}`).join("; ")}</span>
            </span>
            <button className="btn-primary btn-sm">Create invoice</button>
          </form>
        ))}
      </div>
      {screeningInvoices.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Screening invoice</th><th>Employer</th><th>Items</th><th>Total</th></tr></thead>
            <tbody>{screeningInvoices.map((i) => <tr key={i.id}><td className="text-xs">{i.id}</td><td>{E[i.employerId]}</td><td>{i.n}</td><td>{money(i.total)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
