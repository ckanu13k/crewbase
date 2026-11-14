import { describe, expect, it } from "vitest";
import { credentialStatus, evaluateMatch, findCredential, rankCandidates } from "./matching";
import { programsForGaps, gapText } from "./training";
import { defaultExpiry } from "./taxonomy";
import type { Credential, Job, TrainingProgram, Worker } from "./types";

const TODAY = "2026-11-13";

const worker = (o: Partial<Worker> = {}): Worker => ({
  id: "w1", phone: "+17135550100", name: "Test", lang: "en", zip: "77506", radiusMiles: 30,
  shifts: ["day", "turnaround"], trade: "pipefitter", yearsExperience: 6, nccerLevel: 2,
  skills: ["pipe_isometrics", "carbon_steel_pipe", "flange_boltup"], summary: "", consentSms: true,
  onboardingComplete: true, createdAt: TODAY, ...o,
});

const cred = (type: string, o: Partial<Credential> = {}): Credential => ({
  id: `c-${type}`, workerId: "w1", type, number: null, holderName: null, issuedOn: null, expiresOn: null,
  photoPath: null, verification: "verified", verifiedBy: null, verifiedMethod: null, extractionConfidence: null,
  needsReview: false, createdAt: TODAY, ...o,
});

const job = (o: Partial<Job> = {}): Job => ({
  id: "j1", employerId: "e1", title: "Pipefitter", trade: "pipefitter", requiredCredentials: ["osha10", "twic"],
  preferredCredentials: ["basic_plus"], requiredSkills: ["pipe_isometrics", "carbon_steel_pipe", "hydrotest"],
  minNccerLevel: 2, minYears: 4, payMin: 28, payMax: 34, shift: "turnaround", zip: "77536", startDate: "2026-12-01",
  headcount: 2, placementFee: 4000, status: "open", description: "", createdAt: TODAY, ...o,
});

describe("credentialStatus", () => {
  it("classifies expiry windows", () => {
    expect(credentialStatus({ expiresOn: null }, TODAY)).toBe("no_expiry");
    expect(credentialStatus({ expiresOn: "2026-11-01" }, TODAY)).toBe("expired");
    expect(credentialStatus({ expiresOn: "2026-12-20" }, TODAY)).toBe("expiring");
    expect(credentialStatus({ expiresOn: "2027-06-01" }, TODAY)).toBe("valid");
  });
});

describe("findCredential", () => {
  it("lets OSHA 30 satisfy an OSHA 10 requirement", () => {
    expect(findCredential([cred("osha30")], "osha10", TODAY)?.type).toBe("osha30");
  });
  it("prefers an unexpired card over an expired one", () => {
    const old = cred("twic", { id: "old", expiresOn: "2025-01-01" });
    const fresh = cred("twic", { id: "new", expiresOn: "2030-01-01", verification: "self" });
    expect(findCredential([old, fresh], "twic", TODAY)?.id).toBe("new");
  });
});

describe("evaluateMatch", () => {
  it("blocks another trade unless they have at least half the job's skills", () => {
    const creds = [cred("osha10"), cred("twic", { expiresOn: "2029-01-01" })];
    const sparky = worker({ trade: "electrician", skills: ["conduit_bending"] });
    expect(evaluateMatch(sparky, creds, job(), TODAY).gaps.find((g) => g.kind === "trade")?.blocking).toBe(true);
    const welderWhoFits = worker({ trade: "welder", skills: ["pipe_isometrics", "carbon_steel_pipe"] });
    expect(evaluateMatch(welderWhoFits, creds, job(), TODAY).gaps.find((g) => g.kind === "trade")?.blocking).toBe(false);
    expect(evaluateMatch(sparky, [cred("osha10")], job({ trade: "helper", requiredCredentials: ["osha10"], requiredSkills: [] }), TODAY).eligible).toBe(true);
  });

  it("is eligible when every hard requirement is met, and reports soft gaps", () => {
    const r = evaluateMatch(worker(), [cred("osha10"), cred("twic", { expiresOn: "2029-01-01" })], job(), TODAY);
    expect(r.eligible).toBe(true);
    expect(r.matchedSkills).toEqual(["pipe_isometrics", "carbon_steel_pipe"]);
    expect(r.gaps.map((g) => g.kind)).toEqual(expect.arrayContaining(["skill_missing", "preferred_credential_missing"]));
    expect(r.distanceMiles).not.toBeNull();
    expect(r.score).toBeGreaterThan(60);
  });

  it("blocks on a missing required credential", () => {
    const r = evaluateMatch(worker(), [cred("osha10")], job(), TODAY);
    expect(r.eligible).toBe(false);
    expect(r.gaps).toContainEqual(expect.objectContaining({ kind: "credential_missing", credential: "twic", blocking: true }));
  });

  it("judges expiry on the job start date, not today", () => {
    const r = evaluateMatch(worker(), [cred("osha10"), cred("twic", { expiresOn: "2026-11-25" })], job(), TODAY);
    expect(r.gaps).toContainEqual(expect.objectContaining({ kind: "credential_expired", credential: "twic" }));
    expect(r.eligible).toBe(false);
  });

  it("blocks when the job is outside the worker's radius", () => {
    const r = evaluateMatch(worker({ zip: "77449", radiusMiles: 10 }), [cred("osha10"), cred("twic")], job(), TODAY);
    expect(r.gaps).toContainEqual(expect.objectContaining({ kind: "distance", blocking: true }));
  });

  it("treats a 1-year experience shortfall as soft, more as blocking", () => {
    const soft = evaluateMatch(worker({ yearsExperience: 3 }), [cred("osha10"), cred("twic")], job(), TODAY);
    const hard = evaluateMatch(worker({ yearsExperience: 1 }), [cred("osha10"), cred("twic")], job(), TODAY);
    expect(soft.gaps.find((g) => g.kind === "experience")?.blocking).toBe(false);
    expect(hard.gaps.find((g) => g.kind === "experience")?.blocking).toBe(true);
  });

  it("blocks on shift mismatch and NCCER level", () => {
    const r = evaluateMatch(worker({ shifts: ["day"], nccerLevel: 1 }), [cred("osha10"), cred("twic")], job(), TODAY);
    const kinds = r.gaps.filter((g) => g.blocking).map((g) => g.kind);
    expect(kinds).toEqual(expect.arrayContaining(["shift", "nccer_level"]));
  });

  it("scores verified credentials above self-reported ones", () => {
    const v = evaluateMatch(worker(), [cred("osha10"), cred("twic")], job(), TODAY);
    const s = evaluateMatch(worker(), [cred("osha10", { verification: "self" }), cred("twic", { verification: "self" })], job(), TODAY);
    expect(v.score).toBeGreaterThan(s.score);
    expect(s.gaps.filter((g) => g.kind === "credential_unverified")).toHaveLength(2);
  });
});

describe("rankCandidates", () => {
  it("puts every eligible worker above every ineligible one", () => {
    const a = worker({ id: "a" });
    const b = worker({ id: "b", skills: ["pipe_isometrics", "carbon_steel_pipe", "hydrotest"] });
    const ranked = rankCandidates([a, b], { a: [cred("osha10")], b: [cred("osha10"), cred("twic")] }, job(), TODAY);
    expect(ranked.map((r) => r.worker.id)).toEqual(["b", "a"]);
  });
});

describe("training links", () => {
  const p = (o: Partial<TrainingProgram>): TrainingProgram => ({
    id: "p", provider: "X", name: "X", trade: null, coversCredentials: [], coversSkills: [], nccerLevel: null,
    city: "Houston", zip: "77002", nextStart: null, weeks: null, clockHours: null, costUsd: null, funding: [],
    languages: ["en"], url: null, sample: true, ...o,
  });

  it("suggests the soonest upcoming program for a missing credential", () => {
    const r = evaluateMatch(worker(), [cred("osha10")], job(), TODAY);
    const programs = [
      p({ id: "late", coversCredentials: ["twic"], nextStart: "2027-02-01" }),
      p({ id: "soon", coversCredentials: ["twic"], nextStart: "2026-11-20" }),
      p({ id: "past", coversCredentials: ["twic"], nextStart: "2026-10-01" }),
    ];
    const links = programsForGaps(r.gaps, programs, TODAY);
    expect(links[0].gap.credential).toBe("twic");
    expect(links[0].programs.map((x) => x.id)).toEqual(["soon", "late", "past"]);
  });

  it("words gaps in both languages", () => {
    const g = { kind: "credential_missing" as const, blocking: true, credential: "twic" };
    expect(gapText(g, "en")).toContain("TWIC");
    expect(gapText(g, "es")).toContain("Necesitas");
  });
});

describe("defaultExpiry", () => {
  it("adds the credential's validity period", () => {
    expect(defaultExpiry("twic", "2024-03-15")).toBe("2029-03-15");
    expect(defaultExpiry("osha10", "2024-03-15")).toBeNull();
  });
});
