import Link from "next/link";
import { requireCap, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { approvePayRun, buildPayRun, discardPayRun, markPayRunPaid, settlePayout } from "@/app/crew-actions";
import { addDaysISO, sumLines, weekStart } from "@/lib/payroll";
import { payrollPartnerConfigured } from "@/lib/payroll-provider";
import { money } from "@/lib/training";

export default async function AdminPayroll({ searchParams }: { searchParams: Promise<{ run?: string; err?: string; week?: string }> }) {
  const sp = await searchParams;
  await requireCap("payroll");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [runs, timesheets, payouts, workers, employers] = await Promise.all([
    store.table("pay_runs").list(), store.table("timesheets").list(), store.table("payouts").list(), store.table("workers").list(), store.table("employers").list(),
  ]);
  const W = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const E = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  runs.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const lastWeek = weekStart(addDaysISO(today, -7));
  const unrun = timesheets.filter((t) => !t.payRunId && t.date < weekStart(today));
  const unapproved = unrun.filter((t) => t.status !== "approved");
  const pending = payouts.filter((p) => p.status !== "sent").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sel = runs.find((r) => r.id === sp.run) ?? runs.find((r) => r.status !== "paid") ?? null;

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/payroll" wide>
      <PageHeader title="Temp payroll" subtitle="Weekly pay runs from approved timesheets (Mon–Sun). Overtime is counted per worker across all their sites; per diem is paid separately and billed at cost." />
      {!payrollPartnerConfigured() && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">No payroll partner is connected, so CrewPass doesn't move money yet. Approve the run, download the CSV for your payroll provider, then mark it paid. Mark early payouts sent after paying them.</p>
      )}
      {sp.err === "exists" && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">That week already has an approved run.</p>}
      {sp.err === "empty" && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">No approved, unpaid hours in the week of {sp.week}.</p>}

      <div className="card mb-6 flex flex-wrap items-end gap-3">
        <form action={buildPayRun} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Week starting (Monday)</label>
            <input type="date" name="weekOf" defaultValue={lastWeek} className="input" />
          </div>
          <button className="btn-primary" data-testid="build-run">Build pay run</button>
        </form>
        <p className="text-sm text-slate-500">{unrun.length} timesheet(s) from past weeks not in a run yet{unapproved.length ? `, ${unapproved.length} still waiting for approval` : ""}.</p>
      </div>

      {sel && (
        <div className="card mb-6" data-testid="pay-run">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="h2">Week of {sel.periodStart} – {sel.periodEnd} <span className="pill bg-slate-100 align-middle">{sel.status}</span></h2>
              <p className="muted">{sel.lines.length} worker(s) · {sumLines(sel.lines).hours} h · gross {money(sumLines(sel.lines).gross)} · still due {money(sumLines(sel.lines).balance)} · per diem {money(sumLines(sel.lines).perDiem)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/admin/payroll/${sel.id}/csv`} className="btn-ghost btn-sm" data-testid="payroll-csv">Download CSV</a>
              {sel.status === "draft" && <form action={approvePayRun}><input type="hidden" name="runId" value={sel.id} /><button className="btn-primary btn-sm" data-testid="approve-run">Approve and invoice employers</button></form>}
              {sel.status === "draft" && <form action={discardPayRun}><input type="hidden" name="runId" value={sel.id} /><button className="btn-ghost btn-sm">Discard</button></form>}
              {sel.status === "approved" && <form action={markPayRunPaid}><input type="hidden" name="runId" value={sel.id} /><button className="btn-primary btn-sm" data-testid="mark-paid">Mark paid</button></form>}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="data">
              <thead><tr><th>Worker</th><th>Hours</th><th>OT</th><th>Straight time</th><th>OT premium</th><th>Gross</th><th>Paid early</th><th>Due</th><th>Per diem</th></tr></thead>
              <tbody>
                {sel.lines.map((l) => (
                  <tr key={l.workerId} data-testid="pay-line"><td className="font-semibold">{W[l.workerId] ?? l.workerId}</td><td>{l.hours}</td><td>{l.otHours}</td><td>{money(l.straightPay)}</td><td>{money(l.otPremium)}</td><td>{money(l.gross)}</td><td>{money(l.paidEarly)}</td><td className="font-semibold">{money(l.balance)}</td><td>{money(l.perDiem)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-4 mb-1 font-semibold">Employer invoices</h3>
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr><th>Employer</th><th>Regular h</th><th>OT h</th><th>Labor</th><th>Per diem</th><th>Total</th><th>Invoice</th></tr></thead>
              <tbody>
                {sel.invoices.map((i) => (
                  <tr key={i.employerId} data-testid="run-invoice"><td>{E[i.employerId]}</td><td>{i.regHours}</td><td>{i.otHours}</td><td>{money(i.labor)}</td><td>{money(i.perDiem)}</td><td className="font-semibold">{money(i.total)}</td><td className="text-xs">{i.invoiceUrl ? <a href={i.invoiceUrl} target="_blank" rel="noreferrer" className="text-brand underline">open</a> : i.invoiceId ?? "on approval"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {(() => {
            const gross = sumLines(sel.lines).gross;
            const billed = sel.invoices.reduce((a, i) => a + i.labor, 0);
            return <p className="mt-2 text-sm text-slate-600">Labor billed {money(billed)} − gross wages {money(gross)} = <b>{money(billed - gross)}</b> to cover employer payroll taxes, workers' comp, benefits and margin.</p>;
          })()}
        </div>
      )}

      <h2 className="h2 mb-2">Early pay (next-day and instant)</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Shift</th><th>Amount</th><th>Speed</th><th>Status</th><th /></tr></thead>
          <tbody>
            {pending.length === 0 && <tr><td colSpan={6} className="muted">Nothing waiting.</td></tr>}
            {pending.map((p) => (
              <tr key={p.id} data-testid="pending-payout">
                <td>{W[p.workerId]}</td><td>{timesheets.find((t) => t.id === p.timesheetId)?.date}</td><td>{money(p.amount)}</td><td>{p.speed}</td><td>{p.status}</td>
                <td className="flex gap-1">
                  <form action={settlePayout}><input type="hidden" name="payoutId" value={p.id} /><input type="hidden" name="action" value="sent" /><button className="btn-soft btn-sm">Mark sent</button></form>
                  <form action={settlePayout}><input type="hidden" name="payoutId" value={p.id} /><input type="hidden" name="action" value="fail" /><button className="btn-ghost btn-sm">Failed</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h2 mb-2">All runs</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Week</th><th>Workers</th><th>Gross</th><th>Billed</th><th>Status</th></tr></thead>
          <tbody>
            {runs.length === 0 && <tr><td colSpan={5} className="muted">No runs yet.</td></tr>}
            {runs.map((r) => (
              <tr key={r.id}><td><Link href={`/admin/payroll?run=${r.id}`} className="font-semibold text-brand">{r.periodStart}</Link></td><td>{r.lines.length}</td><td>{money(sumLines(r.lines).gross)}</td><td>{money(r.invoices.reduce((a, i) => a + i.total, 0))}</td><td>{r.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
