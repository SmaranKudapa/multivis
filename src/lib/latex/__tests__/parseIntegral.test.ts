import { describe, expect, it } from "vitest";
import { buildIntegralLatex, parseIntegral } from "../parseIntegral";

describe("parseIntegral", () => {
  it("parses a type-I double integral (outer x, inner y)", () => {
    const result = parseIntegral("\\int_{0}^{1}\\int_{x^2}^{\\sqrt{x}} (x+y) \\, dy\\, dx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.integral.mode).toBe("double");
    expect(result.integral.levels).toEqual([
      { varName: "x", lowerLatex: "0", upperLatex: "1" },
      { varName: "y", lowerLatex: "x^2", upperLatex: "\\sqrt{x}" },
    ]);
    expect(result.integral.integrandLatex).toBe("(x+y)");
  });

  it("parses a type-II double integral (outer y, inner x) via differential order", () => {
    const result = parseIntegral("\\int_{0}^{2}\\int_{0}^{y} xy \\, dx\\, dy");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.integral.levels).toEqual([
      { varName: "y", lowerLatex: "0", upperLatex: "2" },
      { varName: "x", lowerLatex: "0", upperLatex: "y" },
    ]);
    expect(result.integral.integrandLatex).toBe("xy");
  });

  it("parses a triple integral", () => {
    const result = parseIntegral(
      "\\int_{0}^{1}\\int_{0}^{1-x}\\int_{0}^{1-x-y} 1 \\, dz\\, dy\\, dx",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.integral.mode).toBe("triple");
    expect(result.integral.levels.map((l) => l.varName)).toEqual(["x", "y", "z"]);
    expect(result.integral.levels[2]).toEqual({ varName: "z", lowerLatex: "0", upperLatex: "1-x-y" });
  });

  it("supports bare (unbraced) simple bounds", () => {
    const result = parseIntegral("\\int_0^1\\int_0^x xy \\, dy\\, dx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.integral.levels[0]).toEqual({ varName: "x", lowerLatex: "0", upperLatex: "1" });
  });

  it("supports a backslash-command bare bound like \\pi", () => {
    const result = parseIntegral("\\int_0^\\pi\\int_0^1 x \\, dy\\, dx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.integral.levels[0].upperLatex).toBe("\\pi");
  });

  it("rejects a single integral (not double/triple)", () => {
    const result = parseIntegral("\\int_{0}^{1} x \\, dx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/found 1/);
  });

  it("rejects more than three integral signs", () => {
    const result = parseIntegral(
      "\\int_0^1\\int_0^1\\int_0^1\\int_0^1 x \\, dw\\,dz\\, dy\\, dx",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/found 4/);
  });

  it("rejects the wrong number of differentials", () => {
    const result = parseIntegral("\\int_{0}^{1}\\int_{0}^{1} xy \\, dx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/only found 1/);
  });

  it("rejects an unknown differential variable", () => {
    const result = parseIntegral("\\int_{0}^{1}\\int_{0}^{1} xy \\, dy\\, dw");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/must be x, y, or z/);
  });

  it("rejects a repeated differential variable", () => {
    const result = parseIntegral("\\int_{0}^{1}\\int_{0}^{1} xy \\, dx\\, dx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/exactly one differential/);
  });

  it("rejects a missing bound", () => {
    const result = parseIntegral("\\int_{0}\\int_{0}^{1} xy \\, dy\\, dx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/missing its upper bound/);
  });

  it("rejects a missing integrand", () => {
    const result = parseIntegral("\\int_{0}^{1}\\int_{0}^{1} \\, dy\\, dx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/missing its integrand/);
  });
});

describe("buildIntegralLatex", () => {
  it("round-trips a double integral through parse -> build -> parse", () => {
    const original = parseIntegral("\\int_{0}^{1}\\int_{x^2}^{\\sqrt{x}} (x+y) \\, dy\\, dx");
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    const rebuilt = buildIntegralLatex(original.integral.levels, original.integral.integrandLatex);
    const reparsed = parseIntegral(rebuilt);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.integral).toEqual(original.integral);
  });

  it("round-trips a triple integral", () => {
    const original = parseIntegral("\\int_{0}^{1}\\int_{0}^{1-x}\\int_{0}^{1-x-y} xyz \\, dz\\, dy\\, dx");
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    const rebuilt = buildIntegralLatex(original.integral.levels, original.integral.integrandLatex);
    const reparsed = parseIntegral(rebuilt);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.integral).toEqual(original.integral);
  });

  it("preserves a type-II (y outer) variable order", () => {
    const original = parseIntegral("\\int_{0}^{2}\\int_{0}^{y} xy \\, dx\\, dy");
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    const rebuilt = buildIntegralLatex(original.integral.levels, original.integral.integrandLatex);
    expect(rebuilt).toContain("dx\\, dy");
    const reparsed = parseIntegral(rebuilt);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.integral.levels.map((l) => l.varName)).toEqual(["y", "x"]);
  });
});
