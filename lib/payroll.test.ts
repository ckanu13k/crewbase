import { describe, expect, it } from "vitest";
import { billRateFor, computeWeek, earlyPayAmount, payRunCsv, shiftHours, weekStart } from "./payroll";
import type { Assignment, Payout, Timesheet } from "./types";

const A = (o: Partial<Assignment> & Pick<Assignment, "id" | "employerId" | "payRate" | "billRate">): Assignment => ({
  jobId: "j", workerId: "w1", matchId: null, startDate: "2026-11-02", endDate: null, perDiem: 0, workOrder: null, status: "active", endedReason: null, createdAt: "", ...o,
});
let n = 0;
const T = (o: Partial<Timesheet> & Pick<Timesheet, "assignmentId" | "date" | "hours">): Timesheet => ({
  id: `t${++n}`, workerId: "w1", employerId: "e1", jobId: "j", clockIn: "07:00", clockOut: null, breakMinutes: 0, attendance: "worked", perDiem: false,
  status: "approved", note: "", approvedBy: null, approvedAt: null, payRunId: null, payoutId: null, createdAt: "", updatedAt: "", ...o,
});

describe("shiftHours", () => {
  it("handles day shifts, breaks and overnight shifts", () => {
    expect(shiftHours("07:00", "17:30", 30)).toBe(10);
    expect(shiftHours("18:00", "04:30", 30)).toBe(10); // crosses midnight
    expect(shiftHours("07:00", "07:00", 0)).toBe(24);
    expect(shiftHours(null, "17:00", 0)).toBe(0);
    expect(shiftHours("25:00", "17:00", 0)).toBe(0);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sunday
    expect(weekStart("2026-11-09")).toBe("2026-11-09"); // Monday
    expect(weekStart("2026-11-11")).toBe("2026-11-09");
  });
});

describe("computeWeek", () => {
  it("pays overtime after 40 hours at 1.5x and bills OT to the site", () => {
    const a = A({ id: "a1", employerId: "e1", payRate: 20, billRate: 29, perDiem: 50 });
    const ts = ["09", "10", "11", "12", "13"].map((d) => T({ assignmentId: "a1", date: `2026-11-${d}`, hours: 10, perDiem: true }));
    const { lines, invoices } = computeWeek(ts, [a]);
    expect(lines[0]).toMatchObject({ hours: 50, regHours: 40, otHours: 10, straightPay: 1000, otPremium: 100, gross: 1100, perDiem: 250, balance: 1100 });
    expect(invoices[0]).toMatchObject({ employerId: "e1", regHours: 40, otHours: 10, labor: 40 * 29 + 10 * 29 * 1.5, perDiem: 250 });
    expect(invoices[0].total).toBe(invoices[0].labor + 250);
  });

  it("uses the weighted regular rate across two companies and bills OT where it happened", () => {
    const a1 = A({ id: "a1", employerId: "e1", payRate: 20, billRate: 30 });
    const a2 = A({ id: "a2", employerId: "e2", payRate: 30, billRate: 45 });
    const ts = [
      T({ assignmentId: "a1", employerId: "e1", date: "2026-11-09", hours: 30 }),
      T({ assignmentId: "a2", employerId: "e2", date: "2026-11-12", hours: 20 }),
    ];
    const { lines, invoices } = computeWeek(ts, [a1, a2]);
    // Straight time 30*20 + 20*30 = 1200 over 50 h → regular rate 24; OT premium 10 * 12 = 120.
    expect(lines[0]).toMatchObject({ hours: 50, otHours: 10, straightPay: 1200, otPremium: 120, gross: 1320 });
    const e1 = invoices.find((i) => i.employerId === "e1")!;
    const e2 = invoices.find((i) => i.employerId === "e2")!;
    expect(e1).toMatchObject({ regHours: 30, otHours: 0, labor: 900 });
    expect(e2).toMatchObject({ regHours: 10, otHours: 10, labor: 10 * 45 + 10 * 45 * 1.5 });
  });

  it("ignores unapproved timesheets, counts no-shows as zero and subtracts early pay", () => {
    const a = A({ id: "a1", employerId: "e1", payRate: 18, billRate: 26, perDiem: 40 });
    const ok = T({ assignmentId: "a1", date: "2026-11-09", hours: 8, perDiem: true });
    const ts = [ok, T({ assignmentId: "a1", date: "2026-11-10", hours: 8, status: "submitted" }), T({ assignmentId: "a1", date: "2026-11-11", hours: 0, attendance: "no_show", perDiem: true })];
    const payouts: Payout[] = [{ id: "p", workerId: "w1", timesheetId: ok.id, amount: earlyPayAmount(ok, a), speed: "instant", status: "sent", providerRef: null, createdAt: "", sentAt: "" }];
    const { lines, invoices } = computeWeek(ts, [a], payouts);
    expect(lines[0]).toMatchObject({ hours: 8, gross: 144, perDiem: 40, paidEarly: 144, balance: 0 });
    expect(invoices[0]).toMatchObject({ labor: 208, perDiem: 40, total: 248 });
  });
});

describe("rates and export", () => {
  it("computes bill rates from a markup", () => {
    expect(billRateFor(20, 45)).toBe(29);
    expect(billRateFor(18.5, 40)).toBe(25.9);
  });
  it("writes a CSV with one row per worker", () => {
    const csv = payRunCsv([{ workerId: "w1", hours: 40, regHours: 40, otHours: 0, straightPay: 800, otPremium: 0, gross: 800, perDiem: 0, paidEarly: 0, balance: 800 }], { w1: "Doe, Jane" }, { start: "2026-11-09", end: "2026-11-15" });
    expect(csv.split("\n")[1]).toBe('2026-11-09,2026-11-15,w1,"Doe, Jane",40,40,0,800,0,800,0,800,0');
  });
});
