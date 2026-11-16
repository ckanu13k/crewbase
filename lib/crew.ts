import "server-only";
// Temp-crew helpers called from server actions and the daily job (not actions themselves).
import { db, newId, nowISO, todayISO } from "./db";
import { audit } from "./audit";
import { getSettings } from "./settings";
import { sendSms } from "./messaging";
import { appUrl } from "./onboarding/runtime";
import { billRateFor } from "./payroll";
import { sendEarlyPay } from "./payroll-provider";
import type { Session } from "./session";
import type { Assignment, Match } from "./types";

/** Called from markHired for temp jobs. Returns the new assignment. */
export async function createAssignmentFor(s: Session, m: Match, payRateIn: number | null, startDate: string): Promise<Assignment | null> {
  const store = await db();
  const job = await store.table("jobs").get(m.jobId);
  if (!job) return null;
  const cfg = await getSettings();
  const payRate = payRateIn && payRateIn > 0 ? Math.max(job.payMin, Math.min(payRateIn, Math.max(job.payMax, job.payMin))) : job.payMin;
  const a: Assignment = {
    id: newId(), jobId: job.id, workerId: m.workerId, employerId: job.employerId, matchId: m.id, startDate, endDate: job.endDate ?? null,
    payRate, billRate: billRateFor(payRate, cfg.tempMarkupPct), perDiem: job.perDiem ?? 0, workOrder: job.workOrder ?? null, status: "active", endedReason: null, createdAt: nowISO(),
  };
  await store.table("assignments").upsert(a);
  await audit(s, "assignment.created", "assignment", a.id, `Temp assignment: worker ${m.workerId} on "${job.title}" from ${startDate} at $${payRate}/hr (bill $${a.billRate}/hr)`);
  const worker = await store.table("workers").get(m.workerId);
  if (worker?.consentSms) {
    const es = worker.lang === "es";
    await sendSms(worker.phone, es
      ? `CrewPass: ¡Quedaste! ${job.title}, empieza ${startDate}, $${payRate}/hr${a.perDiem ? ` + $${a.perDiem}/día de viáticos` : ""}. Marca entrada y salida aquí: ${appUrl()}/me/work`
      : `CrewPass: You're hired! ${job.title}, starts ${startDate}, $${payRate}/hr${a.perDiem ? ` + $${a.perDiem}/day per diem` : ""}. Clock in and out here: ${appUrl()}/me/work`);
  }
  if (worker && worker.payrollStatus !== "ready") await store.table("workers").upsert({ ...worker, payrollStatus: "invited" });
  return a;
}

/** Daily job: send next-day payouts created before today. */
export async function sendDueNextDayPayouts(): Promise<number> {
  const store = await db();
  const today = todayISO();
  let n = 0;
  for (const p of await store.table("payouts").list({ status: "pending" } as never)) {
    if (p.speed !== "next_day" || p.createdAt.slice(0, 10) >= today) continue;
    const sent = await sendEarlyPay(p);
    if (sent.status !== p.status) { await store.table("payouts").upsert(sent); n++; }
  }
  return n;
}

