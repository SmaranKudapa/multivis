import { describe, expect, it } from "vitest";
import { computeIntegral, type IntegralLevel } from "../integration";
import type { ScalarFn } from "../parser";

const constant =
  (value: number): ScalarFn =>
  () =>
    value;

describe("computeIntegral", () => {
  it("computes the area of a rectangle (f=1 over a constant-bounds region)", () => {
    const levels: IntegralLevel[] = [
      { varName: "x", lower: constant(0), upper: constant(2) },
      { varName: "y", lower: constant(0), upper: constant(3) },
    ];
    const result = computeIntegral(() => 1, levels, [20, 20]);
    expect(result.total).toBeCloseTo(6, 5);
    expect(result.invalidCellCount).toBe(0);
  });

  it("computes the area of a triangle (variable inner bound depending on x)", () => {
    const levels: IntegralLevel[] = [
      { varName: "x", lower: constant(0), upper: constant(1) },
      { varName: "y", lower: constant(0), upper: (scope) => 1 - scope.x },
    ];
    const result = computeIntegral(() => 1, levels, [200, 200]);
    expect(result.total).toBeCloseTo(0.5, 2);
  });

  it("computes the volume of a tetrahedron (triple integral)", () => {
    const levels: IntegralLevel[] = [
      { varName: "x", lower: constant(0), upper: constant(1) },
      { varName: "y", lower: constant(0), upper: (scope) => 1 - scope.x },
      { varName: "z", lower: constant(0), upper: (scope) => 1 - scope.x - scope.y },
    ];
    const result = computeIntegral(() => 1, levels, [60, 60, 60]);
    expect(result.total).toBeCloseTo(1 / 6, 2);
  });

  it("works with the outer variable named y (type-II style ordering)", () => {
    // Triangle 0<=y<=1, 0<=x<=y, integrating f = x*y.
    // Exact value: integral_0^1 integral_0^y x*y dx dy = integral_0^1 y^3/2 dy = 1/8.
    const levels: IntegralLevel[] = [
      { varName: "y", lower: constant(0), upper: constant(1) },
      { varName: "x", lower: constant(0), upper: (scope) => scope.y },
    ];
    const result = computeIntegral((scope) => scope.x * scope.y, levels, [300, 300]);
    expect(result.total).toBeCloseTo(1 / 8, 2);
  });

  it("produces one cell per resolution step and records concrete points", () => {
    const levels: IntegralLevel[] = [
      { varName: "x", lower: constant(0), upper: constant(1) },
      { varName: "y", lower: constant(0), upper: constant(1) },
    ];
    const result = computeIntegral(() => 1, levels, [4, 5]);
    expect(result.cells).toHaveLength(20);
    expect(result.validCellCount).toBe(20);
    expect(result.cells[0].point.x).toBeGreaterThan(0);
    expect(result.cells[0].point.y).toBeGreaterThan(0);
  });

  it("treats a degenerate/invalid region (upper <= lower) as contributing nothing", () => {
    const levels: IntegralLevel[] = [
      { varName: "x", lower: constant(0), upper: constant(1) },
      { varName: "y", lower: constant(1), upper: constant(0) }, // inverted bounds
    ];
    const result = computeIntegral(() => 1, levels, [5, 5]);
    expect(result.total).toBe(0);
    expect(result.invalidCellCount).toBe(25);
    expect(result.cells).toHaveLength(0);
  });
});
