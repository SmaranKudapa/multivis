import { describe, expect, it } from "vitest";
import { evaluateLatexIntegral } from "../evaluateIntegral";

describe("evaluateLatexIntegral", () => {
  it("evaluates a type-I double integral end to end", () => {
    // Area between y=x^2 and y=sqrt(x) over [0,1], f=1 -> exact value 1/3.
    const r = evaluateLatexIntegral("\\int_{0}^{1}\\int_{x^2}^{\\sqrt{x}} 1 \\, dy\\, dx", [200, 200]);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.mode).toBe("double");
    expect(r.result.total).toBeCloseTo(1 / 3, 2);
  });

  it("evaluates a type-II double integral (y outer) end to end", () => {
    const r = evaluateLatexIntegral("\\int_{0}^{1}\\int_{0}^{y} xy \\, dx\\, dy", [300, 300]);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.levels[0].varName).toBe("y");
    expect(r.levels[1].varName).toBe("x");
    expect(r.result.total).toBeCloseTo(1 / 8, 2);
  });

  it("evaluates a triple integral (tetrahedron volume) end to end", () => {
    const r = evaluateLatexIntegral(
      "\\int_{0}^{1}\\int_{0}^{1-x}\\int_{0}^{1-x-y} 1 \\, dz\\, dy\\, dx",
      [40, 40, 40],
    );
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.mode).toBe("triple");
    expect(r.result.total).toBeCloseTo(1 / 6, 2);
  });

  it("surfaces a parse error from a malformed integral", () => {
    const r = evaluateLatexIntegral("\\int_{0}^{1} x \\, dx");
    expect(r.status).toBe("error");
    if (r.status !== "error") return;
    expect(r.error).toMatch(/found 1/);
  });

  it("surfaces a bound-compile error (unknown variable in a bound)", () => {
    // The outer x-bound references z, which isn't in scope for that level.
    const r = evaluateLatexIntegral("\\int_{0}^{z}\\int_{0}^{1} xy \\, dy\\, dx");
    expect(r.status).toBe("error");
    if (r.status !== "error") return;
    expect(r.error).toMatch(/Upper bound of x/);
    expect(r.error).toMatch(/Unknown variable "z"/);
  });

  it("surfaces an integrand-compile error", () => {
    const r = evaluateLatexIntegral("\\int_{0}^{1}\\int_{0}^{1} x + \\, dy\\, dx");
    expect(r.status).toBe("error");
    if (r.status !== "error") return;
    expect(r.error).toMatch(/Integrand/);
  });

  it("uses sensible default resolutions when none are given", () => {
    const r = evaluateLatexIntegral("\\int_{0}^{1}\\int_{0}^{1} 1 \\, dy\\, dx");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.result.total).toBeCloseTo(1, 5);
  });
});
