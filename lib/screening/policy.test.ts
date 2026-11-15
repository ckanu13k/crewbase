import { describe, expect, it, vi } from "vitest";
import { businessDaysBetween, canSendFinalNotice, hireGate, kindsToOrder, requiredKinds } from "./policy";
import type { Job, Screening } from "../types";

vi.mock("server-only", () => ({}));

const TODAY = "2026-11-13"; // Friday
const job = (o: Partial<Job> = {}): Job => ({
  id: "j1", employerId: "e1", title: "Fitter", trade: "pipefitter", requiredCredentials: [], preferredCredentials: [], requiredSkills: [],
  minNccerLevel: 0, minYears: 0, payMin: 30, payMax: 35, shift: "day", zip: "77536", startDate: "2026-12-01", headcount: 1, placementFee: 4000,
  status: "open", description: "", createdAt: TODAY, requiresBackground: true, requiresDrug: true, ...o,
});
const scr = (o: Partial<Screening>): Screening => ({
  id: Math.random().toString(36).slice(2), workerId: "w1", employerId: "e1", jobId: "j1", matchId: null, kind: "background", provider: "manual",
  providerRef: null, consentUrl: null, status: "clear", consentAt: null, consentName: null, orderedAt: null, completedAt: null, expiresOn: "2027-06-01",
  reviewedNote: null, preAdverseAt: null, reportCopySent: false, finalAdverseAt: null, priceUsd: 65, invoiceId: null, createdAt: "2026-11-10T00:00:00Z", updatedAt: "", ...o,
});

describe("screening policy", () => {
  it("lists the kinds a job requires", () => {
    expect(requiredKinds(job())).toEqual(["background", "drug"]);
    expect(requiredKinds(job({ requiresBackground: false, requiresDrug: false }))).toEqual([]);
  });

  it("only lets a hire through when every required kind is clear for this employer", () => {
    expect(hireGate(job(), [], TODAY).ok).toBe(false);
    expect(hireGate(job(), [scr({}), scr({ kind: "drug" })], TODAY).ok).toBe(true);
    expect(hireGate(job({ requiresBackground: false, requiresDrug: false }), [], TODAY).ok).toBe(true);
  });

  it("doesn't reuse another employer's result", () => {
    const g = hireGate(job(), [scr({ employerId: "e2" }), scr({ kind: "drug", employerId: "e2" })], TODAY);
    expect(g.ok).toBe(false);
    expect(kindsToOrder(job(), [scr({ employerId: "e2" })], TODAY)).toEqual(["background", "drug"]);
  });

  it("judges validity on the start date", () => {
    const drugExpiresBeforeStart = scr({ kind: "drug", expiresOn: "2026-11-25" });
    const g = hireGate(job(), [scr({}), drugExpiresBeforeStart], TODAY);
    expect(g.ok).toBe(false);
    expect(g.items.find((i) => i.kind === "drug")?.state).toBe("missing");
    expect(kindsToOrder(job(), [scr({}), drugExpiresBeforeStart], TODAY)).toEqual(["drug"]);
  });

  it("doesn't re-order while a screening is pending or under review", () => {
    const rows = [scr({ status: "awaiting_consent" }), scr({ kind: "drug", status: "needs_review" })];
    expect(kindsToOrder(job(), rows, TODAY)).toEqual([]);
    expect(hireGate(job(), rows, TODAY).items.map((i) => i.state)).toEqual(["pending", "review"]);
  });

  it("counts business days and holds the final notice for the waiting period", () => {
    expect(businessDaysBetween("2026-11-13", "2026-11-16")).toBe(1); // Fri → Mon
    expect(businessDaysBetween("2026-11-13", "2026-11-20")).toBe(5);
    const pre = scr({ status: "pre_adverse", preAdverseAt: "2026-11-13T15:00:00Z", reportCopySent: true });
    expect(canSendFinalNotice(pre, "2026-11-19")).toBe(false);
    expect(canSendFinalNotice(pre, "2026-11-20")).toBe(true);
    expect(canSendFinalNotice({ ...pre, reportCopySent: false }, "2026-11-30")).toBe(false);
  });
});

describe("Checkr webhook signature", () => {
  it("accepts a valid HMAC and rejects a forged one", async () => {
    process.env.CHECKR_API_KEY = "test_key";
    const { createHmac } = await import("node:crypto");
    const { verifyCheckrSignature } = await import("./providers");
    const body = JSON.stringify({ type: "report.completed" });
    const sig = createHmac("sha256", "test_key").update(body).digest("hex");
    expect(verifyCheckrSignature(body, sig)).toBe(true);
    expect(verifyCheckrSignature(body, "sha256=" + sig)).toBe(true);
    expect(verifyCheckrSignature(body + " ", sig)).toBe(false);
    expect(verifyCheckrSignature(body, null)).toBe(false);
    delete process.env.CHECKR_API_KEY;
  });
});
