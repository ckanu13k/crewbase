import Link from "next/link";
import { requireEmployer, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, employerNav } from "@/components/Shell";
import { approveAllTimesheets, reviewTimesheet } from "@/app/crew-actions";
import { addDaysISO, computeWeek, weekStart } from "@/lib/payroll";
import { money } from "@/lib/training";
import type { Timesheet } from "@/lib/types";

const ATT: Record<Timesheet["attendance"], string> = { worked: "", late: "Late", no_show: "No-show", called_off: "Called off" };

export default async function EmployerTimesheets({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const s = await requireEmployer();
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const wk = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "") ? sp.week! : today);
  const end = addDaysISO(wk, 6);
  const by = { employerId: s.employerId } as never;
  const [employer, timesheets, assignments, workers, jobs] = await Promise.all([
    store.table("employers").get(s.employerId), store.table("timesheets").list(by), store.table("assignments").list(by), store.table("workers").list(), store.table("jobs").list(by),
  ]);
  const W = Object.fromEntries(workers.map((w) => [w.id, `${w.name.split(" ")[0]} ${w.name.split(" ")[1]?.[0] ?? ""}.`]));
  const J = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
  const waiting = timesheets.filter((t) => t.status === "submitted" || t.status === "disputed").sort((a, b) => a.date.localeCompare(b.date));
  const week = timesheets.filter((t) => t.date >= wk && t.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.workerId.localeCompare(b.workerId));
  const totals = computeWeek(week, assignments).invoices.find((i) => i.employerId === s.employerId);
  const onClock = timesheets.filter((t) => t.status === "open" && t.clockIn && !t.clockOut);

  return (
    <Shell lang={lang} nav={employerNav} back="/employer/timesheets" wide>
      <PageHeader eyebrow={employer?.name} title="Timesheets" subtitle="Approve your temp crew's hours. Approved hours are paid to the worker and show up on your weekly invoice." />
      {onClock.length > 0 && <p className="mb-3 text-sm text-slate-600" data-testid="on-clock-now"><b>On the clock now:</b> {onClock.map((t) => `${W[t.workerId]} (since ${t.clockIn})`).join(", ")}</p>}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Waiting for you ({waiting.length})</h2>
        {waiting.some((t) => t.status === "submitted") && <form action={approveAllTimesheets}><button className="btn-primary btn-sm" data-testid="approve-all">Approve all submitted</button></form>}
      </div>
      {/* One card per shift: readable on a foreman's phone and on a desktop. */}
      <div className="card mb-6 divide-y divide-slate-100 p-0">
        {waiting.length === 0 && <p className="muted p-4">Nothing to approve.</p>}
        {waiting.map((t) => (
          <form key={t.id} action={reviewTimesheet} className="grid gap-2 p-4 md:grid-cols-[minmax(9rem,1fr)_auto_auto] md:items-center" data-testid="timesheet-row">
            <input type="hidden" name="timesheetId" value={t.id} />
            <div>
              <div className="font-semibold">{W[t.workerId]} <span className="font-normal text-slate-500">· {t.date}</span>
                {t.status === "disputed" && <span className="pill ml-1 bg-amber-50 text-amber-800">questioned</span>}</div>
              <div className="text-sm text-slate-500">{J[t.jobId]}</div>
              {t.note && <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{t.note}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <input type="time" name="clockIn" defaultValue={t.clockIn ?? ""} className="input min-h-10 w-[7.5rem] py-1 text-sm" aria-label="In" />
              <span className="text-slate-400">–</span>
              <input type="time" name="clockOut" defaultValue={t.clockOut ?? ""} className="input min-h-10 w-[7.5rem] py-1 text-sm" aria-label="Out" />
              <input type="number" name="breakMinutes" defaultValue={t.breakMinutes} min={0} max={240} className="input min-h-10 w-16 py-1 text-sm" aria-label="Break minutes" title="Break (minutes)" />
              <span className="ml-1 w-12 text-sm font-semibold">{t.hours} h</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button name="action" value="approve" className="btn-primary btn-sm">Approve</button>
              <button name="action" value="late" className="btn-ghost btn-sm">Late</button>
              <button name="action" value="no_show" className="btn-ghost btn-sm">No-show</button>
              <button name="action" value="dispute" className="btn-ghost btn-sm">Question</button>
              <input name="note" placeholder="Note (optional)" className="input min-h-9 w-full py-1 text-sm md:w-40" />
            </div>
          </form>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Week of {wk}</h2>
        <div className="flex gap-2 text-sm">
          <Link className="btn-ghost btn-sm" href={`/employer/timesheets?week=${addDaysISO(wk, -7)}`}>← Previous</Link>
          <Link className="btn-ghost btn-sm" href={`/employer/timesheets?week=${addDaysISO(wk, 7)}`}>Next →</Link>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Day</th><th>In / out</th><th>Hours</th><th>Status</th></tr></thead>
          <tbody>
            {week.length === 0 && <tr><td colSpan={5} className="muted">No hours this week.</td></tr>}
            {week.map((t) => (
              <tr key={t.id}><td>{W[t.workerId]}</td><td>{t.date}</td><td>{t.clockIn ?? "—"} – {t.clockOut ?? "—"}</td><td>{t.hours}{ATT[t.attendance] && <span className="ml-1 text-xs font-semibold text-amber-700">{ATT[t.attendance]}</span>}</td><td>{t.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {totals && <p className="mt-2 text-sm text-slate-600" data-testid="week-bill">Approved so far: {totals.regHours} regular + {totals.otHours} overtime hours · labor {money(totals.labor)}{totals.perDiem ? ` · per diem ${money(totals.perDiem)}` : ""} · <b>{money(totals.total)}</b></p>}
    </Shell>
  );
}
