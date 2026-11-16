"use server";
// Temp crews: hiring onto an assignment, clock in/out, timesheet approval, early pay, payroll runs,
// employer invoices, ratings, crew rosters and benefit plans.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, nowISO, todayISO } from "@/lib/db";
import { requireCap, requireEmployer, requireRole, requireWorker } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { sendSms } from "@/lib/messaging";
import { emailEmployer } from "@/lib/email";
import { appUrl } from "@/lib/onboarding/runtime";
import { addDaysISO, computeWeek, earlyPayAmount, shiftHours, sumLines, weekStart } from "@/lib/payroll";
import { sendEarlyPay } from "@/lib/payroll-provider";
import { stars } from "@/lib/reliability";
import { createTempInvoice } from "@/lib/billing";
import { chicagoNow } from "@/lib/interviews";
import type { Attendance, BenefitPlan, Match, PayoutSpeed, PayRun, Timesheet } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const date = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? str(f, k) : null);
const hhmm = (f: FormData, k: string) => (/^\d{1,2}:\d{2}$/.test(str(f, k)) ? str(f, k).padStart(5, "0") : null);
const nowHHMM = () => chicagoNow().slice(11, 16);
const firstName = (n: string) => n.split(" ")[0];

function refreshCrewPages(jobId?: string) {
  for (const p of ["/me/work", "/employer/timesheets", "/employer/crew", "/employer/hires", "/recruiter/crews", "/admin/payroll"]) revalidatePath(p);
  if (jobId) {
    revalidatePath(`/recruiter/jobs/${jobId}`);
    revalidatePath(`/employer/jobs/${jobId}`);
  }
}

// ---------------- Hiring onto a temp assignment ----------------

export async function endAssignment(form: FormData) {
  const s = await requireRole("employer");
  const store = await db();
  const a = await store.table("assignments").get(str(form, "assignmentId"));
  if (!a || a.status !== "active" || (!isStaffRole(s.role) && a.employerId !== s.employerId)) return;
  const endDate = date(form, "endDate") ?? todayISO();
  await store.table("assignments").upsert({ ...a, status: "ended", endDate, endedReason: str(form, "reason") || "Assignment ended" });
  await audit(s, "assignment.ended", "assignment", a.id, `Ended assignment for worker ${a.workerId} (${str(form, "reason") || "no reason given"})`);
  const job = await store.table("jobs").get(a.jobId);
  if (job && job.status === "filled") await store.table("jobs").upsert({ ...job, status: "open" });
  refreshCrewPages(a.jobId);
}

// ---------------- Worker: clock in / out, timesheets, pay speed ----------------

async function myAssignment(workerId: string, assignmentId: string) {
  const a = await (await db()).table("assignments").get(assignmentId);
  return a && a.workerId === workerId && a.status === "active" ? a : null;
}

export async function clockIn(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const a = await myAssignment(s.workerId, str(form, "assignmentId"));
  if (!a) return;
  const today = todayISO();
  const mine = await store.table("timesheets").list({ assignmentId: a.id } as Partial<Timesheet>);
  if (mine.some((t) => t.status === "open" && t.clockIn && !t.clockOut)) return; // already on the clock
  const existing = mine.find((t) => t.date === today);
  if (existing && existing.status !== "open") return;
  const t: Timesheet = existing ?? {
    id: newId(), assignmentId: a.id, workerId: a.workerId, employerId: a.employerId, jobId: a.jobId, date: today, clockIn: null, clockOut: null, breakMinutes: 0, hours: 0,
    attendance: "worked", perDiem: a.perDiem > 0, status: "open", note: "", approvedBy: null, approvedAt: null, payRunId: null, payoutId: null, createdAt: nowISO(), updatedAt: nowISO(),
  };
  await store.table("timesheets").upsert({ ...t, clockIn: nowHHMM(), updatedAt: nowISO() });
  refreshCrewPages();
}

export async function clockOut(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const a = await myAssignment(s.workerId, str(form, "assignmentId"));
  if (!a) return;
  const open = (await store.table("timesheets").list({ assignmentId: a.id } as Partial<Timesheet>))
    .filter((t) => t.status === "open" && t.clockIn && !t.clockOut)
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  if (!open) return;
  const breakMinutes = Math.max(0, Math.min(240, Number(str(form, "breakMinutes") || 30)));
  // A shift that started before yesterday means a missed clock-out: don't guess the hours, send it for review.
  if (open.date < addDaysISO(todayISO(), -1)) {
    await store.table("timesheets").upsert({ ...open, status: "disputed", hours: 0, note: [open.note, "Missed clock-out — times need fixing."].filter(Boolean).join("\n"), updatedAt: nowISO() });
    refreshCrewPages();
    return;
  }
  const out = nowHHMM();
  await store.table("timesheets").upsert({ ...open, clockOut: out, breakMinutes, hours: shiftHours(open.clockIn, out, breakMinutes), status: "submitted", updatedAt: nowISO() });
  refreshCrewPages();
}

/** Worker fills in or fixes a day (forgot to clock in, wrong time). Approved days are locked. */
export async function saveMyTimesheet(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const a = await myAssignment(s.workerId, str(form, "assignmentId"));
  const day = date(form, "date");
  const inT = hhmm(form, "clockIn");
  const outT = hhmm(form, "clockOut");
  if (!a || !day || !inT || !outT || day > todayISO() || day < a.startDate) return;
  const breakMinutes = Math.max(0, Math.min(240, Number(str(form, "breakMinutes") || 0)));
  const existing = (await store.table("timesheets").list({ assignmentId: a.id } as Partial<Timesheet>)).find((t) => t.date === day);
  if (existing && (existing.status === "approved" || existing.payRunId)) return;
  const t: Timesheet = {
    ...(existing ?? {
      id: newId(), assignmentId: a.id, workerId: a.workerId, employerId: a.employerId, jobId: a.jobId, date: day, attendance: "worked" as Attendance, perDiem: a.perDiem > 0,
      approvedBy: null, approvedAt: null, payRunId: null, payoutId: null, createdAt: nowISO(),
    }),
    clockIn: inT, clockOut: outT, breakMinutes, hours: shiftHours(inT, outT, breakMinutes), status: "submitted", note: str(form, "note").slice(0, 300), updatedAt: nowISO(),
  } as Timesheet;
  await store.table("timesheets").upsert(t);
  refreshCrewPages();
}

export async function setPayoutSpeed(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const w = await store.table("workers").get(s.workerId);
  const speed = (["weekly", "next_day", "instant"] as PayoutSpeed[]).find((x) => x === str(form, "speed"));
  if (!w || !speed) return;
  await store.table("workers").upsert({ ...w, payoutSpeed: speed });
  revalidatePath("/me/work");
}

// ---------------- Employer / recruiter: review timesheets ----------------

async function payEarlyIfChosen(t: Timesheet) {
  const store = await db();
  if (t.status !== "approved" || t.payoutId || t.payRunId) return;
  const [w, a] = await Promise.all([store.table("workers").get(t.workerId), store.table("assignments").get(t.assignmentId)]);
  if (!w || !a || !w.payoutSpeed || w.payoutSpeed === "weekly" || w.payrollStatus !== "ready") return;
  const amount = earlyPayAmount(t, a);
  if (amount <= 0) return;
  let p = { id: newId(), workerId: w.id, timesheetId: t.id, amount, speed: w.payoutSpeed, status: "pending" as const, providerRef: null, createdAt: nowISO(), sentAt: null } as import("@/lib/types").Payout;
  // Instant pay goes out now; next-day pay is sent by the daily job (or by the founder from Payroll).
  if (w.payoutSpeed === "instant") p = await sendEarlyPay(p);
  await store.table("payouts").upsert(p);
  await store.table("timesheets").upsert({ ...t, payoutId: p.id });
}

export async function reviewTimesheet(form: FormData) {
  const s = await requireRole("employer");
  const store = await db();
  const t = await store.table("timesheets").get(str(form, "timesheetId"));
  if (!t || t.payRunId || (!isStaffRole(s.role) && t.employerId !== s.employerId)) return;
  if (t.status === "approved" && !isStaffRole(s.role)) return;
  const action = str(form, "action");
  let next: Timesheet = { ...t, updatedAt: nowISO() };
  const inT = hhmm(form, "clockIn");
  const outT = hhmm(form, "clockOut");
  if (inT && outT) {
    const br = Math.max(0, Math.min(240, Number(str(form, "breakMinutes") || t.breakMinutes)));
    next = { ...next, clockIn: inT, clockOut: outT, breakMinutes: br, hours: shiftHours(inT, outT, br) };
  }
  if (action === "no_show" || action === "called_off") next = { ...next, attendance: action, hours: 0, perDiem: false, clockIn: null, clockOut: null };
  if (action === "late") next = { ...next, attendance: "late" };
  if (str(form, "note")) next.note = [t.note, `${s.actor}: ${str(form, "note")}`].filter(Boolean).join("\n").slice(0, 600);
  if (action === "dispute") next.status = "disputed";
  else next = { ...next, status: "approved", approvedBy: s.actor, approvedAt: nowISO() };
  await store.table("timesheets").upsert(next);
  await audit(s, `timesheet.${action || "approve"}`, "timesheet", t.id, `${action || "approve"}: worker ${t.workerId}, ${t.date}, ${next.hours} h`);
  await payEarlyIfChosen(next);
  refreshCrewPages();
}

export async function approveAllTimesheets() {
  const s = await requireEmployer();
  const store = await db();
  const pending = (await store.table("timesheets").list({ employerId: s.employerId } as Partial<Timesheet>)).filter((t) => t.status === "submitted" && !t.payRunId);
  for (const t of pending) {
    const next: Timesheet = { ...t, status: "approved", approvedBy: s.actor, approvedAt: nowISO(), updatedAt: nowISO() };
    await store.table("timesheets").upsert(next);
    await payEarlyIfChosen(next);
  }
  if (pending.length) await audit(s, "timesheet.approve_all", "employer", s.employerId, `Approved ${pending.length} timesheet(s)`);
  refreshCrewPages();
}

// ---------------- Founder: payroll ----------------

export async function buildPayRun(form: FormData) {
  const s = await requireCap("payroll");
  const store = await db();
  const start = weekStart(date(form, "weekOf") ?? addDaysISO(todayISO(), -7));
  const end = addDaysISO(start, 6);
  const runs = await store.table("pay_runs").list();
  if (runs.some((r) => r.periodStart === start && r.status !== "draft")) redirect(`/admin/payroll?err=exists`);
  for (const r of runs.filter((r) => r.periodStart === start && r.status === "draft")) await discardRun(r);
  const [all, assignments, payouts] = await Promise.all([store.table("timesheets").list(), store.table("assignments").list(), store.table("payouts").list()]);
  const week = all.filter((t) => t.date >= start && t.date <= end && !t.payRunId);
  const approved = week.filter((t) => t.status === "approved");
  if (approved.length === 0) redirect(`/admin/payroll?err=empty&week=${start}`);
  const { lines, invoices } = computeWeek(approved, assignments, payouts);
  const run: PayRun = {
    id: newId(), periodStart: start, periodEnd: end, status: "draft", lines, invoices, timesheetIds: approved.map((t) => t.id),
    createdBy: s.actor, createdAt: nowISO(), approvedAt: null, paidAt: null,
  };
  await store.table("pay_runs").upsert(run);
  for (const t of approved) await store.table("timesheets").upsert({ ...t, payRunId: run.id });
  const tot = sumLines(lines);
  await audit(s, "payroll.draft", "pay_run", run.id, `Pay run ${start}–${end}: ${lines.length} worker(s), ${tot.hours} h, gross $${tot.gross}; ${week.length - approved.length} unapproved timesheet(s) left out`);
  revalidatePath("/admin/payroll");
  redirect(`/admin/payroll?run=${run.id}`);
}

async function discardRun(r: PayRun) {
  const store = await db();
  for (const id of r.timesheetIds) {
    const t = await store.table("timesheets").get(id);
    if (t?.payRunId === r.id) await store.table("timesheets").upsert({ ...t, payRunId: null });
  }
  await store.table("pay_runs").remove(r.id);
}

export async function discardPayRun(form: FormData) {
  const s = await requireCap("payroll");
  const store = await db();
  const r = await store.table("pay_runs").get(str(form, "runId"));
  if (!r || r.status !== "draft") return;
  await discardRun(r);
  await audit(s, "payroll.discarded", "pay_run", r.id, `Discarded draft pay run ${r.periodStart}`);
  revalidatePath("/admin/payroll");
}

/** Approve: locks the hours and sends each employer its weekly invoice. */
export async function approvePayRun(form: FormData) {
  const s = await requireCap("payroll");
  const store = await db();
  const r = await store.table("pay_runs").get(str(form, "runId"));
  if (!r || r.status !== "draft") return;
  const [employers, assignments] = await Promise.all([store.table("employers").list(), store.table("assignments").list()]);
  const workOrders = (employerId: string) => [...new Set(assignments.filter((a) => a.employerId === employerId && a.workOrder).map((a) => a.workOrder))].join(", ");
  const invoices = [];
  for (const inv of r.invoices) {
    const e = employers.find((x) => x.id === inv.employerId);
    if (!e) { invoices.push(inv); continue; }
    const wo = workOrders(e.id);
    const res = await createTempInvoice(e, { start: r.periodStart, end: r.periodEnd, runId: r.id }, [
      { description: `Temp labor ${r.periodStart}–${r.periodEnd}: ${inv.regHours} regular + ${inv.otHours} overtime hours${wo ? ` (PO/WO ${wo})` : ""}`, amountUsd: inv.labor },
      { description: `Per diem (at cost)`, amountUsd: inv.perDiem },
    ].filter((l) => l.amountUsd > 0));
    invoices.push({ ...inv, invoiceId: res.id, invoiceUrl: res.url });
    await emailEmployer(e.id, `Temp labor invoice, week of ${r.periodStart}`, `Hours: ${inv.regHours} regular + ${inv.otHours} overtime. Labor $${inv.labor.toFixed(2)}, per diem $${inv.perDiem.toFixed(2)}, total $${inv.total.toFixed(2)}. Due in 15 days.${res.url ? ` Pay online: ${res.url}` : ""}\nDetails: ${appUrl()}/employer/hires`);
  }
  await store.table("pay_runs").upsert({ ...r, status: "approved", approvedAt: nowISO(), invoices });
  await audit(s, "payroll.approved", "pay_run", r.id, `Approved pay run ${r.periodStart}; invoiced ${invoices.length} employer(s), $${invoices.reduce((x, i) => x + i.total, 0).toFixed(2)}`);
  revalidatePath("/admin/payroll");
  revalidatePath("/employer/hires");
}

export async function markPayRunPaid(form: FormData) {
  const s = await requireCap("payroll");
  const store = await db();
  const r = await store.table("pay_runs").get(str(form, "runId"));
  if (!r || r.status !== "approved") return;
  await store.table("pay_runs").upsert({ ...r, status: "paid", paidAt: nowISO() });
  await audit(s, "payroll.paid", "pay_run", r.id, `Marked pay run ${r.periodStart} paid ($${sumLines(r.lines).balance} gross balance)`);
  for (const l of r.lines) {
    const w = await store.table("workers").get(l.workerId);
    if (w?.consentSms && l.balance > 0) {
      await sendSms(w.phone, w.lang === "es"
        ? `CrewPass: Se pagó tu semana del ${r.periodStart}: ${l.hours} h, bruto $${l.balance.toFixed(2)}${l.perDiem ? ` + viáticos $${l.perDiem.toFixed(2)}` : ""}. Detalle: ${appUrl()}/me/work`
        : `CrewPass: Your pay for the week of ${r.periodStart} is on its way: ${l.hours} h, $${l.balance.toFixed(2)} gross${l.perDiem ? ` + $${l.perDiem.toFixed(2)} per diem` : ""}. Details: ${appUrl()}/me/work`);
    }
  }
  revalidatePath("/admin/payroll");
  revalidatePath("/me/work");
}

/** Founder marks a pending early payout as sent (paid through the payroll partner) or retries it. */
export async function settlePayout(form: FormData) {
  const s = await requireCap("payroll");
  const store = await db();
  const p = await store.table("payouts").get(str(form, "payoutId"));
  if (!p || p.status === "sent") return;
  const action = str(form, "action");
  const next = action === "fail" ? { ...p, status: "failed" as const } : action === "retry" ? await sendEarlyPay({ ...p, status: "pending" }) : { ...p, status: "sent" as const, sentAt: nowISO(), providerRef: p.providerRef ?? "manual" };
  await store.table("payouts").upsert(next);
  await audit(s, `payout.${action || "sent"}`, "payout", p.id, `Early pay $${p.amount} to worker ${p.workerId}: ${next.status}`);
  revalidatePath("/admin/payroll");
  revalidatePath("/me/work");
}

// ---------------- Ratings and crews ----------------

export async function rateWorker(form: FormData) {
  const s = await requireRole("employer");
  const store = await db();
  const assignmentId = str(form, "assignmentId") || null;
  const placementId = str(form, "placementId") || null;
  const src = assignmentId ? await store.table("assignments").get(assignmentId) : placementId ? await store.table("placements").get(placementId) : null;
  if (!src || (!isStaffRole(s.role) && src.employerId !== s.employerId)) return;
  const existing = (await store.table("ratings").list({ workerId: src.workerId } as never)).find((r) => (assignmentId && r.assignmentId === assignmentId) || (placementId && r.placementId === placementId));
  const rehire = str(form, "rehire") === "yes";
  await store.table("ratings").upsert({
    id: existing?.id ?? newId(), workerId: src.workerId, employerId: src.employerId, jobId: src.jobId, assignmentId, placementId,
    quality: stars(str(form, "quality")), safety: stars(str(form, "safety")), rehire, comment: str(form, "comment").slice(0, 500), by: s.actor, createdAt: nowISO(),
  });
  if (rehire && str(form, "addToCrew") === "on") {
    const roster = await store.table("crew_roster").list({ employerId: src.employerId } as never);
    if (!roster.some((c) => c.workerId === src.workerId)) await store.table("crew_roster").upsert({ id: newId(), employerId: src.employerId, workerId: src.workerId, note: "", addedBy: s.actor, createdAt: nowISO() });
  }
  await audit(s, "worker.rated", "worker", src.workerId, `Rated quality ${stars(str(form, "quality"))}, safety ${stars(str(form, "safety"))}, rehire ${rehire ? "yes" : "no"}`);
  refreshCrewPages(src.jobId);
}

export async function addToCrew(form: FormData) {
  const s = await requireEmployer();
  const store = await db();
  const workerId = str(form, "workerId");
  // Only people who have worked for this employer can be added.
  const worked = [
    ...(await store.table("assignments").list({ employerId: s.employerId } as never)),
    ...(await store.table("placements").list({ employerId: s.employerId } as never)),
  ].some((x) => x.workerId === workerId);
  const roster = await store.table("crew_roster").list({ employerId: s.employerId } as never);
  if (!worked || roster.some((c) => c.workerId === workerId)) return;
  await store.table("crew_roster").upsert({ id: newId(), employerId: s.employerId, workerId, note: str(form, "note").slice(0, 120), addedBy: s.actor, createdAt: nowISO() });
  revalidatePath("/employer/crew");
}

export async function removeFromCrew(form: FormData) {
  const s = await requireEmployer();
  const store = await db();
  const c = await store.table("crew_roster").get(str(form, "id"));
  if (c && c.employerId === s.employerId) await store.table("crew_roster").remove(c.id);
  revalidatePath("/employer/crew");
}

/** Offer an open job to the crew first: texts each roster member and puts them in the pipeline. */
export async function offerToCrew(form: FormData) {
  const s = await requireEmployer();
  const store = await db();
  const job = await store.table("jobs").get(str(form, "jobId"));
  if (!job || job.employerId !== s.employerId || job.status !== "open") return;
  const [roster, matches, active] = await Promise.all([
    store.table("crew_roster").list({ employerId: s.employerId } as never),
    store.table("matches").list({ jobId: job.id } as Partial<Match>),
    store.table("assignments").list({ status: "active" } as never),
  ]);
  const busy = new Set(active.filter((a) => !a.endDate || a.endDate >= job.startDate).map((a) => a.workerId));
  let n = 0;
  for (const c of roster) {
    if (matches.some((m) => m.workerId === c.workerId) || busy.has(c.workerId)) continue;
    const w = await store.table("workers").get(c.workerId);
    if (!w) continue;
    await store.table("matches").upsert({ id: newId(), jobId: job.id, workerId: w.id, stage: "shortlisted", score: 0, notes: "Rehire offer from the employer's crew list.", createdAt: nowISO(), updatedAt: nowISO() });
    if (w.consentSms) {
      await sendSms(w.phone, w.lang === "es"
        ? `CrewPass: ${firstName(w.name)}, quieren volver a trabajar contigo: ${job.title}, empieza ${job.startDate}, $${job.payMin}${job.payMax > job.payMin ? `-${job.payMax}` : ""}/hr. ¿Te interesa? ${appUrl()}/me/jobs/${job.id}`
        : `CrewPass: ${firstName(w.name)}, they want you back: ${job.title}, starts ${job.startDate}, $${job.payMin}${job.payMax > job.payMin ? `-${job.payMax}` : ""}/hr. Interested? ${appUrl()}/me/jobs/${job.id}`);
    }
    n++;
  }
  await audit(s, "crew.offer", "job", job.id, `Offered "${job.title}" to ${n} crew member(s)`);
  revalidatePath(`/employer/jobs/${job.id}`);
  redirect(`/employer/jobs/${job.id}?offered=${n}`);
}

// ---------------- Benefit plans (founder) ----------------

export async function saveBenefitPlan(form: FormData) {
  const s = await requireCap("payroll");
  const store = await db();
  const id = str(form, "id") || newId();
  const kinds: BenefitPlan["kind"][] = ["workers_comp", "occupational_accident", "health", "dental_vision", "paid_time_off", "retirement", "other"];
  const name = str(form, "name");
  if (!name) return;
  await store.table("benefit_plans").upsert({
    id, kind: kinds.find((k) => k === str(form, "kind")) ?? "other", name, carrier: str(form, "carrier"), status: str(form, "status") === "active" ? "active" : "planned",
    eligibility: str(form, "eligibility"), workerCost: str(form, "workerCost"), url: /^https:\/\//.test(str(form, "url")) ? str(form, "url") : null,
    createdAt: (await store.table("benefit_plans").get(id))?.createdAt ?? nowISO(),
  });
  await audit(s, "benefits.saved", "benefit_plan", id, `Saved benefit plan "${name}"`);
  revalidatePath("/admin/benefits");
  revalidatePath("/me/benefits");
}

export async function deleteBenefitPlan(form: FormData) {
  const s = await requireCap("payroll");
  await (await db()).table("benefit_plans").remove(str(form, "id"));
  await audit(s, "benefits.deleted", "benefit_plan", str(form, "id"), "Deleted a benefit plan");
  revalidatePath("/admin/benefits");
  revalidatePath("/me/benefits");
}

/** Founder or recruiter: mark a worker's payroll onboarding (W-4, I-9, deposit) done with the partner. */
export async function setPayrollStatus(form: FormData) {
  const s = await requireRole("staff");
  const store = await db();
  const w = await store.table("workers").get(str(form, "workerId"));
  const status = (["not_started", "invited", "ready"] as const).find((x) => x === str(form, "status"));
  if (!w || !status) return;
  await store.table("workers").upsert({ ...w, payrollStatus: status });
  await audit(s, "worker.payroll_status", "worker", w.id, `Payroll onboarding: ${status}`);
  revalidatePath(`/recruiter/workers/${w.id}`);
  revalidatePath("/recruiter/crews");
}
