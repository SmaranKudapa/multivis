import { describe, expect, it } from "vitest";
import { sampleTypeIBoundary } from "../regionBoundary";

describe("sampleTypeIBoundary", () => {
  it("closes the loop (first and last points coincide)", () => {
    const points = sampleTypeIBoundary(0, 1, () => 0, (o) => 1 - o, 40);
    expect(points[0]).toEqual(points[points.length - 1]);
  });

  it("traces a rectangle's four sides in order", () => {
    const points = sampleTypeIBoundary(
      0,
      2,
      () => 0,
      () => 3,
      4,
    );
    // 4 segments -> exactly one sample per corner: bottom-left, bottom-right, top-right, top-left, back to bottom-left.
    expect(points).toEqual([
      { outer: 0, inner: 0 },
      { outer: 2, inner: 0 },
      { outer: 2, inner: 3 },
      { outer: 0, inner: 3 },
      { outer: 0, inner: 0 },
    ]);
  });

  it("stays within the region's bounds throughout", () => {
    const lowerAt = () => -1;
    const upperAt = (o: number) => Math.sqrt(Math.max(0, 1 - o * o));
    const points = sampleTypeIBoundary(-1, 1, lowerAt, upperAt, 80);
    for (const p of points) {
      expect(p.outer).toBeGreaterThanOrEqual(-1 - 1e-9);
      expect(p.outer).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
