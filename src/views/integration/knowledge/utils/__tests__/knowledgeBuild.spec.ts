import { describe, expect, it } from "vitest";

import { findMilestone } from "../buildMilestones";

describe("findMilestone", () => {
  it("returns undefined below the first milestone", () => {
    expect(findMilestone(0, 24)).toBeUndefined();
  });

  it("returns 25 when crossing the first milestone", () => {
    expect(findMilestone(0, 25)).toBe(25);
    expect(findMilestone(24, 30)).toBe(25);
  });

  it("returns the first crossed mark when jumping several at once", () => {
    expect(findMilestone(0, 80)).toBe(25);
    expect(findMilestone(20, 76)).toBe(25);
  });

  it("does not repeat a milestone already reported", () => {
    expect(findMilestone(25, 26)).toBeUndefined();
    expect(findMilestone(50, 75)).toBe(75);
    expect(findMilestone(75, 100)).toBeUndefined();
  });
});
