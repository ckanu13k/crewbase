import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DEFAULT_SETTINGS, SETTING_DEFS, feeFor } from "./settings";

describe("settings", () => {
  it("defaults match the original estimates", () => {
    expect(DEFAULT_SETTINGS.feeMid).toBe(4000);
    expect(DEFAULT_SETTINGS.guaranteeDays).toBe(90);
    expect(DEFAULT_SETTINGS.adverseWaitDays).toBe(5);
    expect(SETTING_DEFS.adverseWaitDays.min).toBe(5); // can't be set below common practice
  });
  it("prices a job from the current fee settings", () => {
    const s = { ...DEFAULT_SETTINGS, feeEntry: 2500, feeMid: 4200, feeJourney: 6000 };
    expect(feeFor({ trade: "helper", minYears: 0, minNccerLevel: 0, requiredCredentials: [] }, s)).toBe(2500);
    expect(feeFor({ trade: "pipefitter", minYears: 3, minNccerLevel: 2, requiredCredentials: [] }, s)).toBe(4200);
    expect(feeFor({ trade: "electrician", minYears: 3, minNccerLevel: 2, requiredCredentials: ["tdlr_journeyman_electrician"] }, s)).toBe(6000);
  });
});
