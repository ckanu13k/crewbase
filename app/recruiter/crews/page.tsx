import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, staffNav } from "@/components/Shell";
import { ReliabilityPill } from "@/components/CrewBadges";
import { endAssignment, reviewTimesheet, setPayrollStatus } from "@/app/crew-actions";
import { crewSignals } from "@/lib/crewdata";
import { addDaysISO } from "@/lib/payroll";

export default async function RecruiterCrews() {
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [assignments, timesheets, workers, jobs, employers] = await Promise.all([
    store.table("assignments").list(), store.table("timesheets").list(), store.table("workers").list(), store.table("jobs").list(), store.table("employers").list(),
  ]);
  const W = Object.fromEntries(workers.map((w) => [w.id, w]));
  const J = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
  const E = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  const active = assignments.filter((a) => a.status === "active").sort((a, b) => a.employerId.localeCompare(b.employerId));
  const sig = await crewSignals(active.map((a) => a.workerId));
  const stale = timesheets.filter((t) => (t.status === "submitted" && t.date <= addDaysISO(today, -2)) || t.status === "disputed").sort((a, b) => a.date.localeCompare(b.date));
  const noShows = timesheets.filter((t) => t.attendance === "no_show" && t.date >= addDaysISO(today, -14));
  const forgot = timesheets.filter((t) => t.status === "open" && t.clockIn && !t.clockOut && t.date < today);

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/crews" wide>
      <PageHeader title="Temp crews" subtitle="Who's working where, hours that need a nudge, and payroll paperwork." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><div className="muted">Working now</div><div className="text-xl font-bold">{active.length}</div></div>
        <div className="card"><div className="muted">Hours stuck or questioned</div><div className="text-xl font-bold">{stale.length}</div></div>
        <div className="card"><div className="muted">No-shows (14 days)</div><div className="text-xl font-bold">{noShows.length}</div></div>
        <div className="card"><div className="muted">Forgot to clock out</div><div className="text-xl font-bold">{forgot.length}</div></div>
      </div>

      <h2 className="h2 mb-2">On assignment</h2>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Employer / job</th><th>Dates</th><th>Pay / bill</th><th>Track record</th><th>Payroll paperwork</th><th /></tr></thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan={7} className="muted">Nobody on a temp assignment.</td></tr>}
            {active.map((a) => (
              <tr key={a.id} data-testid="crew-row">
                <td><Link href={`/recruiter/workers/${a.workerId}`} className="font-semibold text-brand">{W[a.workerId]?.name}</Link><div className="muted">{W[a.workerId]?.phone}</div></td>
                <td>{E[a.employerId]}<div className="muted">{J[a.jobId]}{a.workOrder ? ` · WO ${a.workOrder}` : ""}</div></td>
                <td>{a.startDate} → {a.endDate ?? "open"}</td>
                <td>${a.payRate} / ${a.billRate}{a.perDiem ? <div className="muted">+${a.perDiem}/day</div> : null}</td>
                <td><ReliabilityPill r={sig.rel(a.workerId)} /></td>
                <td>
                  <form action={setPayrollStatus} className="flex gap-1">
                    <input type="hidden" name="workerId" value={a.workerId} />
                    <select name="status" defaultValue={W[a.workerId]?.payrollStatus ?? "not_started"} className="input min-h-9 py-1 text-sm">
                      <option value="not_started">Not started</option><option value="invited">Link sent</option><option value="ready">Done (W-4, I-9, deposit)</option>
                    </select>
                    <button className="btn-ghost btn-sm">Set</button>
                  </form>
                </td>
                <td>
                  <form action={endAssignment} className="flex gap-1">
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <input type="hidden" name="reason" value="Ended by recruiter" />
                    <button className="btn-ghost btn-sm">End</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h2 mb-2">Hours that need attention</h2>
      <p className="muted mb-2">Submitted 2+ days ago without approval, questioned by the employer, or a missing clock-out. Call the site, then fix and approve on their behalf.</p>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Employer</th><th>Day</th><th>Fix and approve</th></tr></thead>
          <tbody>
            {[...stale, ...forgot].length === 0 && <tr><td colSpan={4} className="muted">All caught up.</td></tr>}
            {[...stale, ...forgot].map((t) => (
              <tr key={t.id} data-testid="attention-row">
                <td className="font-semibold">{W[t.workerId]?.name}</td>
                <td>{E[t.employerId]}</td>
                <td>{t.date} <span className="pill bg-slate-100">{t.status}</span></td>
                <td>
                  <form action={reviewTimesheet} className="flex flex-wrap items-center gap-1">
                    <input type="hidden" name="timesheetId" value={t.id} />
                    <input type="time" name="clockIn" defaultValue={t.clockIn ?? ""} className="input min-h-9 w-28 py-1 text-sm" aria-label="In" />
                    <input type="time" name="clockOut" defaultValue={t.clockOut ?? ""} className="input min-h-9 w-28 py-1 text-sm" aria-label="Out" />
                    <input type="number" name="breakMinutes" defaultValue={t.breakMinutes} className="input min-h-9 w-20 py-1 text-sm" aria-label="Break" />
                    <input name="note" placeholder="What the site said" className="input min-h-9 w-44 py-1 text-sm" />
                    <button name="action" value="approve" className="btn-primary btn-sm">Approve</button>
                    <button name="action" value="no_show" className="btn-ghost btn-sm">No-show</button>
                    {t.note && <span className="w-full whitespace-pre-wrap text-xs text-slate-500">{t.note}</span>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
