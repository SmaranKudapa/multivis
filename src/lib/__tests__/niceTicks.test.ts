import { describe, expect, it } from "vitest";
import { computeNiceTicks } from "../niceTicks";

describe("computeNiceTicks", () => {
  it("picks round steps for a 0-10 range", () => {
    expect(computeNiceTicks(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("picks round steps for a -1 to 1 range", () => {
    expect(computeNiceTicks(-1, 1)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it("only returns ticks within [min, max]", () => {
    const ticks = computeNiceTicks(0.3, 4.7);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(0.3);
      expect(t).toBeLessThanOrEqual(4.7);
    }
  });

  it("returns an empty array for a degenerate or invalid range", () => {
    expect(computeNiceTicks(5, 5)).toEqual([]);
    expect(computeNiceTicks(5, 2)).toEqual([]);
    expect(computeNiceTicks(NaN, 10)).toEqual([]);
  });

  it("never produces a -0 tick", () => {
    const ticks = computeNiceTicks(-2, 2);
    expect(ticks.some((t) => Object.is(t, -0))).toBe(false);
  });
});
