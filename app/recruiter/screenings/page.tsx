import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, staffNav } from "@/components/Shell";
import { money } from "@/lib/training";
import { activeProvider } from "@/lib/screening/providers";
import {
  ADVERSE_WAIT_BUSINESS_DAYS, FCRA_RIGHTS_URL, KIND_LABEL, billable, businessDaysBetween, canSendFinalNotice, employerLabel,
} from "@/lib/screening/policy";
import {
  cancelScreening, clearAfterReview, markScreeningOrdered, recordScreeningResult, sendFinalAdverseNotice, sendPreAdverseNotice,
} from "@/app/screening-actions";
import type { Screening } from "@/lib/types";
import { can } from "@/lib/permissions";

const ORDER: Screening["status"][] = ["needs_review", "pre_adverse", "in_progress", "awaiting_consent", "clear", "not_cleared", "canceled"];

export default async function ScreeningsAdmin() {
  const session = await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [rows, workers, jobs, employers] = await Promise.all([
    store.table("screenings").list(),
    store.table("workers").list(),
    store.table("jobs").list(),
    store.table("employers").list(),
  ]);
  const W = Object.fromEntries(workers.map((w) => [w.id, w]));
  const J = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const E = Object.fromEntries(employers.map((e) => [e.id, e]));
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
  const owed = employers
    .map((e) => ({ e, rows: billable(rows.filter((r) => r.employerId === e.id)) }))
    .filter((x) => x.rows.length);
  const provider = activeProvider();

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/screenings" wide>
      <PageHeader
        eyebrow="Screening"
        title="Background checks and drug screens"
        subtitle={
          provider === "checkr"
            ? "Checkr is connected: workers authorize on Checkr's page and results arrive automatically."
            : "Manual mode: workers authorize here, you order in your provider's portal (e.g. DISA or your lab) and record the outcome. Add CHECKR_API_KEY to automate."
        }
      />
      <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Only the outcome and dates are kept here; reports stay with the provider. A flagged result is never an automatic no: review it, then either clear the worker with a note or follow the two FCRA notices — a pre-adverse notice with a copy of the report and the{" "}
        <a href={FCRA_RIGHTS_URL} target="_blank" rel="noreferrer" className="underline">Summary of Rights</a>, wait {ADVERSE_WAIT_BUSINESS_DAYS} business days, then a final notice.
      </div>

      {owed.length > 0 && can(session.role, "bill") && (
        <Link href="/admin/billing" className="mb-4 flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark ring-1 ring-blue-200">
          <span>{owed.reduce((n, x) => n + x.rows.length, 0)} screening(s) ready to bill</span><span>Admin → Billing →</span>
        </Link>
      )}

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Worker / job</th><th>Check</th><th>Status</th><th>Dates</th><th>Price</th><th>Next step</th></tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={6} className="muted">Nothing yet. Request screenings from a job's pipeline.</td></tr>}
            {sorted.map((r) => {
              const waited = r.preAdverseAt ? businessDaysBetween(r.preAdverseAt, today) : 0;
              return (
                <tr key={r.id} data-testid="screening-row">
                  <td>
                    <Link href={`/recruiter/workers/${r.workerId}`} className="font-semibold text-brand hover:text-brand-dark">{W[r.workerId]?.name ?? r.workerId}</Link>
                    <div className="muted"><Link href={`/recruiter/jobs/${r.jobId}`} className="hover:underline">{J[r.jobId]?.title}</Link> · {E[r.employerId]?.name}</div>
                  </td>
                  <td>{KIND_LABEL[r.kind].en}<div className="text-xs text-slate-400">{r.provider}</div></td>
                  <td><span className={`pill ${r.status === "clear" ? "bg-emerald-50 text-emerald-700" : r.status === "needs_review" || r.status === "pre_adverse" ? "bg-amber-50 text-amber-800" : r.status === "not_cleared" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>{employerLabel(r)}</span>
                    {r.reviewedNote && <div className="mt-1 max-w-[16rem] text-xs text-slate-500">Reviewed: {r.reviewedNote}</div>}
                  </td>
                  <td className="text-xs text-slate-500">
                    {r.consentAt && <div>Authorized {r.consentAt.slice(0, 10)}{r.consentName ? ` (${r.consentName})` : ""}</div>}
                    {r.orderedAt && <div>Ordered {r.orderedAt.slice(0, 10)}</div>}
                    {r.completedAt && <div>Result {r.completedAt.slice(0, 10)}</div>}
                    {r.expiresOn && <div>Good through {r.expiresOn}</div>}
                    {r.preAdverseAt && <div>Pre-adverse {r.preAdverseAt.slice(0, 10)} ({waited}/{ADVERSE_WAIT_BUSINESS_DAYS} business days)</div>}
                    {r.finalAdverseAt && <div>Final notice {r.finalAdverseAt.slice(0, 10)}</div>}
                  </td>
                  <td className="text-sm">{money(r.priceUsd)}{r.invoiceId && <div className="text-xs text-slate-400">invoiced</div>}</td>
                  <td className="min-w-[15rem] text-sm">
                    {r.status === "awaiting_consent" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">Waiting on the worker{r.consentUrl ? " (Checkr link sent)" : ""}</span>
                        <form action={cancelScreening}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost btn-sm">Cancel</button></form>
                      </div>
                    )}
                    {r.status === "in_progress" && r.provider === "manual" && (
                      <div className="space-y-1">
                        {!r.orderedAt && <form action={markScreeningOrdered}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost btn-sm">Ordered with provider</button></form>}
                        <div className="flex gap-1">
                          <form action={recordScreeningResult}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="result" value="clear" /><button className="btn-primary btn-sm">Clear</button></form>
                          <form action={recordScreeningResult}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="result" value="needs_review" /><button className="btn-ghost btn-sm">Flagged</button></form>
                        </div>
                      </div>
                    )}
                    {r.status === "in_progress" && r.provider === "checkr" && <span className="text-slate-500">Waiting on Checkr</span>}
                    {(r.status === "needs_review" || r.status === "pre_adverse") && (
                      <form action={clearAfterReview} className="mb-2 flex gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="note" required maxLength={300} placeholder="Why it's OK for this job (no report details)" className="input min-h-9 py-1 text-sm" />
                        <button className="btn-primary btn-sm">Clear</button>
                      </form>
                    )}
                    {r.status === "needs_review" && (
                      <form action={sendPreAdverseNotice} className="space-y-1">
                        <input type="hidden" name="id" value={r.id} />
                        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="reportCopySent" value="yes" required /> Copy of the report + Summary of Rights sent to the worker</label>
                        <button className="btn-ghost btn-sm">Send pre-adverse notice</button>
                      </form>
                    )}
                    {r.status === "pre_adverse" && (
                      <form action={sendFinalAdverseNotice}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn-ghost btn-sm" disabled={!canSendFinalNotice(r, today)}>
                          {canSendFinalNotice(r, today) ? "Send final notice" : `Final notice after ${ADVERSE_WAIT_BUSINESS_DAYS} business days`}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
