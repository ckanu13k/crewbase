import { describe, expect, it } from "vitest";
import { reliability } from "./reliability";
import { cleanSlots, interviewIcs } from "./interviews";
import { payStats, type PaySample } from "./paycompare";
import { csvEscape, isPrivateIp, isSafeWebhookUrl, signPayload } from "./webhooks";
import { ASSESSMENTS, ASSESSMENT_BY_ID, QUESTIONS_PER_TEST, TIME_LIMIT_MIN, assessmentsForTrade, bestResults, drawQuestions, gradeAttempt, nextAttemptAt } from "./assessments";
import { QUIZZES } from "./quizzes";
import { averageHours, monthlyHours } from "./benefits";
import { evaluateMatch } from "./matching";
import { TRADES, SKILLS, CREDENTIALS, SECTORS, TRADE_BY_ID } from "./taxonomy";
import type { AssessmentAttempt, Interview, Job, Worker } from "./types";

describe("reliability", () => {
  it("waits for 3 shifts, then scores attendance", () => {
    expect(reliability([{ attendance: "worked", status: "approved" }], []).score).toBeNull();
    const r = reliability(
      [
        { attendance: "worked", status: "approved" }, { attendance: "worked", status: "approved" }, { attendance: "late", status: "approved" },
        { attendance: "no_show", status: "approved" }, { attendance: "worked", status: "submitted" },
      ],
      [{ quality: 4, safety: 5, rehire: true }, { quality: 3, safety: 4, rehire: false }],
    );
    expect(r.shifts).toBe(4); // the submitted one isn't counted yet
    expect(r.score).toBe(68); // (1+1+0.7+0)/4
    expect(r.label).toBe("poor");
    expect(r).toMatchObject({ noShows: 1, late: 1, quality: 3.5, safety: 4.5, rehirePct: 50 });
  });
});

describe("interviews", () => {
  it("keeps only future, distinct, well-formed slots (max 3)", () => {
    expect(cleanSlots(["2026-11-20T09:00", "2026-11-20T09:00", "bad", "2026-11-01T09:00", "2026-11-21T10:00", "2026-11-22T10:00", "2026-11-23T10:00"], "2026-11-15T12:00"))
      .toEqual(["2026-11-20T09:00", "2026-11-21T10:00", "2026-11-22T10:00"]);
  });
  it("builds a calendar file in Chicago time", () => {
    const i: Interview = { id: "i1", matchId: "m", jobId: "j", workerId: "w", employerId: "e", slots: [], chosenSlot: "2026-11-20T09:00", mode: "in_person", location: "Yard, 123 Main; Gate 2", status: "booked", createdBy: "", createdAt: "", updatedAt: "" };
    const ics = interviewIcs(i, "Interview: Forklift operator", new Date("2026-11-15T00:00:00Z"));
    expect(ics).toContain("DTSTART;TZID=America/Chicago:20261120T090000");
    expect(ics).toContain("DTEND;TZID=America/Chicago:20261120T093000");
    expect(ics).toContain("LOCATION:Yard\\, 123 Main\\; Gate 2");
  });
});

describe("pay comparison", () => {
  const S = (trade: string, hourly: number, source: PaySample["source"] = "job", zip = "77002"): PaySample => ({ trade, hourly, source, zip });
  it("hides trades with too few samples and drops implausible pay", () => {
    const { shown, hidden } = payStats([S("welder", 30), S("welder", 34), S("welder", 40, "worker"), S("welder", 900), S("painter", 20), S("painter", 22)], { minSamples: 3 });
    expect(shown).toEqual([{ trade: "welder", n: 3, jobs: 2, reports: 1, median: 34, p25: 32, p75: 37 }]);
    expect(hidden).toEqual([{ trade: "painter", n: 2 }]);
  });
  it("filters by distance", () => {
    const { shown } = payStats([S("welder", 30, "job", "77640"), S("welder", 31, "job", "77640"), S("welder", 32, "job", "77640"), S("welder", 40, "job", "77002")], { minSamples: 3, nearZip: "77701" });
    expect(shown[0].n).toBe(3);
  });
});

describe("webhooks", () => {
  it("accepts public https hosts only", () => {
    expect(isSafeWebhookUrl("https://hooks.example-ats.com/crewpass").ok).toBe(true);
    for (const bad of ["http://hooks.example.com/x", "https://127.0.0.1/x", "https://localhost/x", "https://[::1]/x", "https://user:pw@example.com/x", "https://intranet/x", "https://example.com:22/x", "nope"]) {
      expect(isSafeWebhookUrl(bad).ok, bad).toBe(false);
    }
  });
  it("flags private addresses", () => {
    for (const ip of ["10.1.2.3", "172.20.0.1", "192.168.1.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("signs timestamp.body with HMAC-SHA256", () => {
    expect(signPayload("s", 1, "{}")).toMatch(/^[0-9a-f]{64}$/);
    expect(signPayload("s", 1, "{}")).not.toBe(signPayload("s", 2, "{}"));
  });
  it("neutralizes spreadsheet formulas in CSV", () => {
    expect(csvEscape("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvEscape('a "b", c')).toBe('"a ""b"", c"');
  });
});

describe("skills tests", () => {
  it("has well-formed banks that don't reuse practice questions", () => {
    const practice = new Set(QUIZZES.flatMap((q) => q.questions.map((x) => x.q.en)));
    const ids = new Set<string>();
    for (const a of ASSESSMENTS) {
      expect(a.questions.length).toBeGreaterThanOrEqual(QUESTIONS_PER_TEST);
      for (const q of a.questions) {
        expect(ids.has(q.id)).toBe(false);
        ids.add(q.id);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(q.q.es.length).toBeGreaterThan(0);
        expect(practice.has(q.q.en)).toBe(false);
      }
      for (const t of a.trades) expect(TRADE_BY_ID[t], t).toBeTruthy();
    }
  });
  it("draws distinct questions and grades on the server", () => {
    const a = ASSESSMENT_BY_ID["forklift-warehouse"];
    const ids = drawQuestions(a, () => 0.5);
    expect(new Set(ids).size).toBe(QUESTIONS_PER_TEST);
    const key = Object.fromEntries(a.questions.map((q) => [q.id, q.answer]));
    const att = { assessmentId: a.id, questionIds: ids, startedAt: "2026-11-15T10:00:00Z" };
    const right = ids.map((id) => key[id]);
    expect(gradeAttempt(att, right, new Date("2026-11-15T10:05:00Z"), 70)).toMatchObject({ score: 100, passed: true, late: false });
    const sixRight = right.map((v, i) => (i < 6 ? v : (v + 1) % 4));
    expect(gradeAttempt(att, sixRight, new Date("2026-11-15T10:05:00Z"), 70)).toMatchObject({ score: 75, passed: true });
    const fiveRight = right.map((v, i) => (i < 5 ? v : (v + 1) % 4));
    expect(gradeAttempt(att, fiveRight, new Date("2026-11-15T10:05:00Z"), 70).passed).toBe(false);
    const late = new Date(Date.parse(att.startedAt) + (TIME_LIMIT_MIN + 2) * 60_000);
    expect(gradeAttempt(att, right, late, 70)).toMatchObject({ score: 0, passed: false, late: true });
  });
  it("enforces the retake wait and prefers passing hands-on results", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const at = (iso: string): AssessmentAttempt => ({ id: iso, workerId: "w", assessmentId: "jobsite-safety", kind: "knowledge", questionIds: [], answers: [], startedAt: iso, completedAt: iso, score: 50, passed: false, proctored: false, assessor: null, note: null });
    expect(nextAttemptAt([], "jobsite-safety", 30, now)).toBeNull();
    expect(nextAttemptAt([at("2026-11-01T00:00:00Z")], "jobsite-safety", 30, now)?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(nextAttemptAt([at("2026-10-01T00:00:00Z")], "jobsite-safety", 30, now)).toBeNull();
    const pass = { ...at("2026-10-01T00:00:00Z"), id: "p", score: 90, passed: true };
    const hands = { ...at("2026-11-02T00:00:00Z"), id: "h", kind: "hands_on" as const, score: 100, passed: true, assessor: "x" };
    const best = bestResults([at("2026-11-01T00:00:00Z"), pass, hands]);
    expect(best["jobsite-safety"].knowledge?.id).toBe("p");
    expect(best["jobsite-safety"].handsOn?.id).toBe("h");
  });
  it("offers tests by trade", () => {
    expect(assessmentsForTrade("forklift_operator").map((a) => a.id)).toEqual(["forklift-warehouse"]);
    expect(assessmentsForTrade(null)).toEqual([]);
  });
});

describe("benefits hours", () => {
  it("adds approved paid hours per month and averages, counting empty months", () => {
    const by = monthlyHours([
      { date: "2026-11-02", hours: 10, attendance: "worked", status: "approved" },
      { date: "2026-11-03", hours: 10, attendance: "no_show", status: "approved" },
      { date: "2026-10-30", hours: 8, attendance: "late", status: "approved" },
      { date: "2026-11-04", hours: 10, attendance: "worked", status: "submitted" },
    ]);
    expect(by).toEqual({ "2026-11": 10, "2026-10": 8 });
    expect(averageHours({ "2026-11": 150, "2026-10": 120, "2026-09": 120 }, "2026-11")).toBe(130);
    expect(averageHours({ "2026-01": 90, "2025-12": 90 }, "2026-01", 2)).toBe(90);
  });
});

describe("sectors and taxonomy", () => {
  it("every trade belongs to a sector and every skill points at real trades", () => {
    const sectorIds = new Set(SECTORS.map((s) => s.id));
    for (const t of TRADES) expect(t.sectors.length > 0 && t.sectors.every((s) => sectorIds.has(s)), t.id).toBe(true);
    for (const s of SKILLS) for (const t of s.trades) expect(TRADE_BY_ID[t], `${s.id} → ${t}`).toBeTruthy();
    expect(new Set(CREDENTIALS.map((c) => c.id)).size).toBe(CREDENTIALS.length);
    for (const sector of sectorIds) expect(TRADES.some((t) => t.sectors.includes(sector)), sector).toBe(true);
  });
  it("entry-level jobs are open to any trade; skilled ones aren't", () => {
    const w: Worker = { id: "w", phone: "+1", name: "x", lang: "en", zip: "77449", radiusMiles: 0, shifts: [], trade: "welder", yearsExperience: 3, nccerLevel: 0, skills: [], summary: "", consentSms: true, onboardingComplete: true, createdAt: "" };
    const job = (trade: string): Job => ({ id: "j", employerId: "e", title: "t", trade, requiredCredentials: [], preferredCredentials: [], requiredSkills: ["order_picking"], minNccerLevel: 0, minYears: 0, payMin: 17, payMax: 19, shift: "day", zip: "77449", startDate: "2026-12-01", headcount: 1, placementFee: 0, status: "open", description: "", createdAt: "" });
    expect(evaluateMatch(w, [], job("picker_packer"), "2026-11-15").eligible).toBe(true);
    expect(evaluateMatch(w, [], job("forklift_operator"), "2026-11-15").eligible).toBe(false);
  });
});
