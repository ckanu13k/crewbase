import Link from "next/link";
import { requireEmployer, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, employerNav } from "@/components/Shell";
import { money } from "@/lib/training";
import { KIND_LABEL, employerLabel } from "@/lib/screening/policy";
import type { Placement, Screening } from "@/lib/types";

const STATUS: Record<Placement["status"], string> = {
  active: "Working — fee due at day 30",
  day30_confirmed: "Past day 30 — invoice coming",
  invoiced: "Invoiced",
  paid: "Paid",
  left_early: "Left early — free replacement",
  replaced: "Replaced",
};

export default async function EmployerHires() {
  const s = await requireEmployer();
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [placements, screenings, workers, jobs, employer, assignments, runs] = await Promise.all([
    store.table("placements").list({ employerId: s.employerId } as Partial<Placement>),
    store.table("screenings").list({ employerId: s.employerId } as Partial<Screening>),
    store.table("workers").list(),
    store.table("jobs").list({ employerId: s.employerId } as never),
    store.table("employers").get(s.employerId),
    store.table("assignments").list({ employerId: s.employerId } as never),
    store.table("pay_runs").list(),
  ]);
  const tempInvoices = runs.filter((r) => r.status !== "draft").flatMap((r) => r.invoices.filter((i) => i.employerId === s.employerId).map((i) => ({ r, i }))).sort((a, b) => b.r.periodStart.localeCompare(a.r.periodStart));
  const W = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const J = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
  const due = placements.filter((p) => p.status === "invoiced").reduce((a, p) => a + p.fee, 0);
  const upcoming = placements.filter((p) => ["active", "day30_confirmed"].includes(p.status)).reduce((a, p) => a + p.fee, 0);
  const shortName = (n: string | undefined) => (n ? `${n.split(" ")[0]} ${n.split(" ")[1]?.[0] ?? ""}.` : "—");

  return (
    <Shell lang={lang} nav={employerNav} back="/employer/hires" wide>
      <PageHeader eyebrow={employer?.name} title="Hires & billing" subtitle="Direct hires and their replacement guarantee, temp crews and their weekly invoices, and what you owe." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card"><div className="muted">Hires</div><div className="text-xl font-bold">{placements.length}</div></div>
        <div className="card"><div className="muted">Due now</div><div className="text-xl font-bold">{money(due)}</div></div>
        <div className="card"><div className="muted">Coming at day 30</div><div className="text-xl font-bold">{money(upcoming)}</div></div>
      </div>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Job</th><th>Started</th><th>Fee due</th><th>Guarantee</th><th>Fee</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {placements.length === 0 && <tr><td colSpan={8} className="muted">No hires yet.</td></tr>}
            {placements.map((p) => (
              <tr key={p.id} data-testid="employer-hire">
                <td className="font-semibold">{shortName(W[p.workerId])}</td>
                <td>{J[p.jobId]}</td>
                <td>{p.startDate}</td>
                <td>{p.day30Date}</td>
                <td className={p.guaranteeEndsOn >= today ? "" : "text-slate-400"}>{p.guaranteeEndsOn >= today ? `until ${p.guaranteeEndsOn}` : "ended"}</td>
                <td>{money(p.fee)}</td>
                <td>{STATUS[p.status]}{p.invoiceUrl && <div><a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand underline">View & pay invoice</a></div>}</td>
                <td>{p.startDate <= today && <Link href={`/employer/jobs/${p.jobId}#hired`} className="text-sm font-semibold text-brand" data-testid="rate-link">Rate →</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="h2 mb-2">Temp crew</h2>
      <div className="card mb-3 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Job</th><th>Dates</th><th>Pay / bill rate</th><th>Per diem</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {assignments.length === 0 && <tr><td colSpan={7} className="muted">No temp assignments yet.</td></tr>}
            {assignments.sort((a, b) => b.startDate.localeCompare(a.startDate)).map((a) => (
              <tr key={a.id} data-testid="employer-assignment">
                <td className="font-semibold">{shortName(W[a.workerId])}</td><td>{J[a.jobId]}</td><td>{a.startDate} → {a.endDate ?? "open"}</td>
                <td>${a.payRate} / <b>${a.billRate}</b> per hr</td><td>{a.perDiem ? money(a.perDiem) + "/day" : "—"}</td><td>{a.status}{a.endedReason ? ` (${a.endedReason})` : ""}</td>
                <td><Link href={`/employer/jobs/${a.jobId}#hired`} className="text-sm font-semibold text-brand" data-testid="rate-link">Rate →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Week</th><th>Hours</th><th>Labor</th><th>Per diem</th><th>Total</th><th>Invoice</th></tr></thead>
          <tbody>
            {tempInvoices.length === 0 && <tr><td colSpan={6} className="muted">Weekly temp invoices will show here.</td></tr>}
            {tempInvoices.map(({ r, i }) => (
              <tr key={r.id} data-testid="temp-invoice">
                <td>{r.periodStart} – {r.periodEnd}</td><td>{i.regHours} + {i.otHours} OT</td><td>{money(i.labor)}</td><td>{money(i.perDiem)}</td><td className="font-semibold">{money(i.total)}</td>
                <td>{i.invoiceUrl ? <a href={i.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand underline">View & pay</a> : i.invoiceId ? "sent" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="h2 mb-2">Screenings</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker</th><th>Job</th><th>Check</th><th>Outcome</th><th>Price</th></tr></thead>
          <tbody>
            {screenings.length === 0 && <tr><td colSpan={5} className="muted">None yet.</td></tr>}
            {screenings.filter((x) => x.status !== "canceled").map((x) => (
              <tr key={x.id}>
                <td className="font-semibold">{shortName(W[x.workerId])}</td>
                <td>{J[x.jobId]}</td>
                <td>{KIND_LABEL[x.kind].en}</td>
                <td>{employerLabel(x)}</td>
                <td>{x.orderedAt ? money(x.priceUsd) : "—"}{x.invoiceId && <div className="text-xs text-slate-400">invoiced</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted mt-3">Questions about an invoice? Reply to the invoice email or call your recruiter.</p>
    </Shell>
  );
}
