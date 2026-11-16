// Temp-crew payroll math. Pure functions, tested in payroll.test.ts.
//
// CrewPass is the employer of record for temp work, so overtime follows the FLSA:
// - The workweek is Monday 00:00 to Sunday 24:00 (any fixed 7-day period is allowed; we use this one).
// - Hours over 40 in a workweek are overtime, counted across ALL of a worker's assignments that week,
//   even at different companies.
// - If the worker had different pay rates that week, the overtime premium uses the weighted-average
//   "regular rate" (29 CFR 778.115): total straight-time pay / total hours, and the premium is half that
//   rate for each overtime hour (the straight time for those hours is already in straight-time pay).
// - Billing: the client is billed for the hours worked at its site. Overtime hours are assigned in
//   time order (the hours after the 40th fall on whichever site the worker was at), and billed at
//   1.5 × that site's bill rate.
// Per diem is reported separately from wages and billed at cost. Taxes are withheld by the payroll partner.

import type { Assignment, PayInvoice, PayLine, Payout, Timesheet } from "./types";

export const OT_THRESHOLD = 40;
export const OT_MULTIPLIER = 1.5;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "HH:MM" → minutes after midnight, or null. */
export function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Hours between clock-in and clock-out, minus breaks. A clock-out at or before clock-in is the next morning. */
export function shiftHours(clockIn: string | null, clockOut: string | null, breakMinutes = 0): number {
  const a = toMinutes(clockIn);
  const b = toMinutes(clockOut);
  if (a === null || b === null) return 0;
  let mins = b - a;
  if (mins <= 0) mins += 24 * 60;
  mins -= Math.max(0, breakMinutes);
  return r2(Math.max(0, mins) / 60);
}

/** Monday of the week containing `iso` (YYYY-MM-DD). */
export function weekStart(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Hours that count as paid work on a timesheet (no-shows and call-offs are 0). */
export const paidHours = (t: Pick<Timesheet, "attendance" | "hours">) => (t.attendance === "worked" || t.attendance === "late" ? t.hours : 0);

export function billRateFor(payRate: number, markupPct: number) {
  return r2(payRate * (1 + markupPct / 100));
}

export interface WeekResult {
  lines: PayLine[];
  invoices: PayInvoice[];
}

/**
 * Pay and bill for approved timesheets in one Monday–Sunday week.
 * `payouts` are early payments (next-day / instant) already sent for these timesheets.
 */
export function computeWeek(timesheets: Timesheet[], assignments: Assignment[], payouts: Payout[] = []): WeekResult {
  const asg = Object.fromEntries(assignments.map((a) => [a.id, a]));
  const approved = timesheets.filter((t) => t.status === "approved" && asg[t.assignmentId]);
  const byWorker: Record<string, Timesheet[]> = {};
  for (const t of approved) (byWorker[t.workerId] ??= []).push(t);

  const inv: Record<string, PayInvoice> = {};
  const invoiceFor = (employerId: string) => (inv[employerId] ??= { employerId, regHours: 0, otHours: 0, labor: 0, perDiem: 0, total: 0, invoiceId: null, invoiceUrl: null });
  const lines: PayLine[] = [];

  for (const [workerId, ts] of Object.entries(byWorker)) {
    const ordered = [...ts].sort((a, b) => (a.date + (a.clockIn ?? "")).localeCompare(b.date + (b.clockIn ?? "")));
    let total = 0;
    let straightPay = 0;
    let perDiem = 0;
    let cumulative = 0;
    for (const t of ordered) {
      const a = asg[t.assignmentId];
      const h = paidHours(t);
      total += h;
      straightPay += h * a.payRate;
      if (t.perDiem && h > 0) {
        perDiem += a.perDiem;
        invoiceFor(a.employerId).perDiem += a.perDiem;
      }
      // Split this shift's hours into regular and overtime, in time order, for billing.
      const reg = Math.max(0, Math.min(h, OT_THRESHOLD - cumulative));
      const ot = h - reg;
      cumulative += h;
      const i = invoiceFor(a.employerId);
      i.regHours += reg;
      i.otHours += ot;
      i.labor += reg * a.billRate + ot * a.billRate * OT_MULTIPLIER;
    }
    const otHours = Math.max(0, total - OT_THRESHOLD);
    const regularRate = total > 0 ? straightPay / total : 0;
    const otPremium = otHours * regularRate * (OT_MULTIPLIER - 1);
    const gross = straightPay + otPremium;
    const ids = new Set(ts.map((t) => t.id));
    const paidEarly = payouts.filter((p) => p.workerId === workerId && ids.has(p.timesheetId) && p.status !== "failed").reduce((s, p) => s + p.amount, 0);
    lines.push({
      workerId, hours: r2(total), regHours: r2(total - otHours), otHours: r2(otHours), straightPay: r2(straightPay), otPremium: r2(otPremium),
      gross: r2(gross), perDiem: r2(perDiem), paidEarly: r2(paidEarly), balance: r2(gross - paidEarly),
    });
  }

  const invoices = Object.values(inv).map((i) => ({ ...i, regHours: r2(i.regHours), otHours: r2(i.otHours), labor: r2(i.labor), perDiem: r2(i.perDiem), total: r2(i.labor + i.perDiem) }));
  return { lines: lines.sort((a, b) => a.workerId.localeCompare(b.workerId)), invoices: invoices.sort((a, b) => a.employerId.localeCompare(b.employerId)) };
}

/**
 * Early pay for one approved shift: its straight-time earnings. Overtime premium and per diem are
 * settled on the weekly payday, so an early payout never pays more than the week will owe.
 */
export function earlyPayAmount(t: Timesheet, a: Assignment): number {
  return r2(paidHours(t) * a.payRate);
}

/** Totals for display. */
export function sumLines(lines: PayLine[]) {
  return lines.reduce(
    (s, l) => ({ hours: r2(s.hours + l.hours), gross: r2(s.gross + l.gross), perDiem: r2(s.perDiem + l.perDiem), balance: r2(s.balance + l.balance) }),
    { hours: 0, gross: 0, perDiem: 0, balance: 0 },
  );
}

export function payRunCsv(lines: PayLine[], names: Record<string, string>, period: { start: string; end: string }): string {
  const head = ["period_start", "period_end", "worker_id", "worker_name", "hours", "regular_hours", "overtime_hours", "straight_time_pay", "overtime_premium", "gross_wages", "paid_early", "gross_due", "per_diem"];
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = lines.map((l) => [period.start, period.end, l.workerId, names[l.workerId] ?? "", l.hours, l.regHours, l.otHours, l.straightPay, l.otPremium, l.gross, l.paidEarly, l.balance, l.perDiem].map(esc).join(","));
  return [head.join(","), ...rows].join("\n") + "\n";
}
