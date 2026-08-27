import { describe, expect, it } from "vitest";
import { latexToMathJs } from "../latexToMathJs";
import { evaluate } from "mathjs";

function evalAt(latex: string, scope: Record<string, number>): number {
  return evaluate(latexToMathJs(latex), scope);
}

describe("latexToMathJs", () => {
  it("converts \\frac to a division", () => {
    expect(evalAt("\\frac{1}{2}", {})).toBeCloseTo(0.5);
    expect(evalAt("\\frac{x}{y}", { x: 6, y: 3 })).toBeCloseTo(2);
  });

  it("converts \\sqrt, with and without a degree", () => {
    expect(evalAt("\\sqrt{9}", {})).toBeCloseTo(3);
    expect(evalAt("\\sqrt[3]{27}", {})).toBeCloseTo(3);
  });

  it("converts \\pi and \\infty", () => {
    expect(evalAt("\\pi", {})).toBeCloseTo(Math.PI);
    expect(evaluate(latexToMathJs("\\infty"))).toBe(Infinity);
  });

  it("converts \\cdot and \\times to multiplication", () => {
    expect(evalAt("2 \\cdot 3", {})).toBeCloseTo(6);
    expect(evalAt("2 \\times 3", {})).toBeCloseTo(6);
  });

  it("converts trig/log/exp functions, backslash and bare forms", () => {
    expect(evalAt("\\sin(0)", {})).toBeCloseTo(0);
    expect(evalAt("sin(0)", {})).toBeCloseTo(0);
    expect(evalAt("\\ln(1)", {})).toBeCloseTo(0);
    expect(evalAt("\\exp(0)", {})).toBeCloseTo(1);
    expect(evalAt("\\log(100)", {})).toBeCloseTo(2);
  });

  it("handles exponents, braced and bare", () => {
    expect(evalAt("x^{2}", { x: 5 })).toBeCloseTo(25);
    expect(evalAt("x^2", { x: 5 })).toBeCloseTo(25);
    expect(evalAt("e^{-x}", { x: 0 })).toBeCloseTo(1);
  });

  it("inserts implicit multiplication between adjacent variables/numbers", () => {
    expect(evalAt("xy", { x: 3, y: 4 })).toBeCloseTo(12);
    expect(evalAt("2x", { x: 5 })).toBeCloseTo(10);
    expect(evalAt("x2", { x: 5 })).toBeCloseTo(10);
    expect(evalAt("(x+1)(y+1)", { x: 1, y: 2 })).toBeCloseTo(6);
    expect(evalAt("2(x+1)", { x: 1 })).toBeCloseTo(4);
  });

  it("does not mangle function names that contain a reserved variable letter", () => {
    // "exp" contains an "x" adjacent to a letter -- must not become "ex*p(...)"
    expect(evalAt("\\exp(x)", { x: 1 })).toBeCloseTo(Math.E);
    expect(evalAt("2\\exp(x)", { x: 0 })).toBeCloseTo(2);
    expect(evalAt("x\\exp(x)", { x: 1 })).toBeCloseTo(Math.E);
  });

  it("handles a realistic nested bound expression", () => {
    expect(evalAt("\\sqrt{1 - x^2}", { x: 0 })).toBeCloseTo(1);
    expect(evalAt("4 - x - y", { x: 1, y: 1 })).toBeCloseTo(2);
  });

  it("strips \\left and \\right delimiters", () => {
    expect(evalAt("\\left(x+1\\right)", { x: 1 })).toBeCloseTo(2);
  });
});
