import { describe, expect, it } from "vitest";
import { colormap, makeNormalizer } from "../colormap";

describe("colormap", () => {
  it("returns the first stop color at t=0 and last stop color at t=1", () => {
    expect(colormap(0).getHexString()).toBe("3b4cc0");
    expect(colormap(1).getHexString()).toBe("b40426");
  });

  it("clamps values outside [0,1]", () => {
    expect(colormap(-5).getHexString()).toBe(colormap(0).getHexString());
    expect(colormap(5).getHexString()).toBe(colormap(1).getHexString());
  });

  it("returns a color partway through the scale at t=0.5", () => {
    const c = colormap(0.5);
    expect(c.getHexString()).toBe("dcdcdc");
  });
});

describe("makeNormalizer", () => {
  it("maps min to 0 and max to 1", () => {
    const normalize = makeNormalizer([2, 5, 10]);
    expect(normalize(2)).toBeCloseTo(0);
    expect(normalize(10)).toBeCloseTo(1);
    expect(normalize(6)).toBeCloseTo(0.5, 5);
  });

  it("returns 0.5 for an empty list", () => {
    const normalize = makeNormalizer([]);
    expect(normalize(42)).toBe(0.5);
  });

  it("returns 0.5 for a flat (zero-range) list", () => {
    const normalize = makeNormalizer([7, 7, 7]);
    expect(normalize(7)).toBe(0.5);
  });
});
