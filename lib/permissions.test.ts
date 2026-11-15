import { describe, expect, it } from "vitest";
import { can, isStaffRole, normalizeRole } from "./permissions";

describe("permissions", () => {
  it("gives admins everything and recruiters only operations", () => {
    for (const cap of ["recruit", "bill", "manageTeam", "manageEmployers", "manageTraining", "settings"] as const) expect(can("admin", cap)).toBe(true);
    expect(can("recruiter", "recruit")).toBe(true);
    expect(can("recruiter", "postJobForAnyEmployer")).toBe(true);
    for (const cap of ["bill", "manageTeam", "manageEmployers", "manageTraining", "settings"] as const) expect(can("recruiter", cap)).toBe(false);
  });
  it("gives employers and workers no staff capabilities", () => {
    for (const r of ["employer", "worker"] as const) {
      expect(can(r, "recruit")).toBe(false);
      expect(can(r, "viewAllCards")).toBe(false);
      expect(isStaffRole(r)).toBe(false);
    }
    expect(can(null, "recruit")).toBe(false);
  });
  it("limits training providers to their own listings", () => {
    expect(can("provider", "manageOwnListings")).toBe(true);
    for (const cap of ["recruit", "bill", "manageTraining", "viewAllCards", "viewAudit"] as const) expect(can("provider", cap)).toBe(false);
    expect(can("recruiter", "viewAudit")).toBe(false);
    expect(can("admin", "viewAudit")).toBe(true);
  });
  it("maps the old shared staff role to admin and rejects unknown roles", () => {
    expect(normalizeRole("staff")).toBe("admin");
    expect(normalizeRole("recruiter")).toBe("recruiter");
    expect(normalizeRole("superuser")).toBeNull();
  });
});
