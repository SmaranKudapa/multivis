import { describe, expect, it } from "vitest";
import { safeBounds } from "../safeBounds";

describe("safeBounds", () => {
  it("passes through two finite bounds unchanged", () => {
    expect(safeBounds(1, 5)).toEqual([1, 5]);
  });

  it("collapses to the finite side when the other is NaN", () => {
    expect(safeBounds(2, NaN)).toEqual([2, 2]);
    expect(safeBounds(NaN, 3)).toEqual([3, 3]);
  });

  it("falls back to [0, 0] when both are non-finite", () => {
    expect(safeBounds(NaN, NaN)).toEqual([0, 0]);
    expect(safeBounds(Infinity, -Infinity)).toEqual([0, 0]);
  });
});
