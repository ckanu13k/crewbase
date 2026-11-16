import { describe, expect, it } from "vitest";
import { decideSignIn } from "./signin";

const base = { intent: undefined, email: null, phone: null, staffRole: null, employerId: null, providerId: null } as const;

describe("decideSignIn", () => {
  it("signs a founder in as a worker when they choose worker", () => {
    expect(decideSignIn({ ...base, intent: "worker", email: "founder@x.com", staffRole: "admin" })).toEqual({ kind: "worker" });
  });
  it("gives admin only through the company/staff choice", () => {
    expect(decideSignIn({ ...base, intent: "employer", email: "founder@x.com", staffRole: "admin" })).toEqual({ kind: "admin" });
    expect(decideSignIn({ ...base, intent: "employer", email: "rec@x.com", staffRole: "recruiter" })).toEqual({ kind: "recruiter" });
  });
  it("routes employer and provider emails, and refuses unknown company emails", () => {
    expect(decideSignIn({ ...base, intent: "employer", email: "boss@co.com", employerId: "e1" })).toEqual({ kind: "employer", employerId: "e1" });
    expect(decideSignIn({ ...base, intent: "employer", email: "school@x.com", providerId: "pr1" })).toEqual({ kind: "provider", providerId: "pr1" });
    expect(decideSignIn({ ...base, intent: "employer", email: "nobody@x.com" })).toEqual({ kind: "denied" });
  });
  it("treats phone sign-in as a worker, and an employer email choosing worker as a worker", () => {
    expect(decideSignIn({ ...base, phone: "+17135550100" })).toEqual({ kind: "worker" });
    expect(decideSignIn({ ...base, intent: "worker", email: "boss@co.com", employerId: "e1" })).toEqual({ kind: "worker" });
  });
});
