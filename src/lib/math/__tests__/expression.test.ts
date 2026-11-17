import { describe, expect, it } from "vitest";
import { tokenize } from "../tokenize";
import { parseExpression, ExpressionError } from "../expression";
import { compile } from "../compile";

/** Parses + compiles a LaTeX expression in x, y, theta and evaluates it. */
function ev(latex: string, vars: Record<string, number> = {}): number {
  const names = ["x", "y", "theta", "r"];
  const fn = compile(parseExpression(tokenize(latex)), names);
  return fn(names.map((n) => vars[n] ?? 0));
}

function errorOf(latex: string): string {
  try {
    parseExpression(tokenize(latex));
  } catch (e) {
    if (e instanceof ExpressionError) return e.message;
    throw e;
  }
  throw new Error(`expected ${latex} to fail`);
}

describe("expression parsing and evaluation", () => {
  it("handles arithmetic precedence and unary minus", () => {
    expect(ev("1+2\\cdot3")).toBe(7);
    expect(ev("-x^2", { x: 3 })).toBe(-9);
    expect(ev("2-3-4")).toBe(-5);
    expect(ev("x\\times-y", { x: 2, y: 3 })).toBe(-6);
    expect(ev("8\\div2\\div2")).toBe(2);
  });

  it("handles implicit multiplication", () => {
    expect(ev("2x", { x: 3 })).toBe(6);
    expect(ev("xy", { x: 2, y: 5 })).toBe(10);
    expect(ev("(x+1)(x-1)", { x: 3 })).toBe(8);
    expect(ev("2\\pi")).toBeCloseTo(2 * Math.PI);
    expect(ev("x\\sqrt{y}", { x: 2, y: 9 })).toBe(6);
  });

  it("follows LaTeX script rules (x^23 is x²·3, \\frac12 is 1/2)", () => {
    expect(ev("x^23", { x: 2 })).toBe(12);
    expect(ev("x^{23}", { x: 1 })).toBe(1);
    expect(ev("\\frac12")).toBe(0.5);
    expect(ev("\\frac{x+1}{2}", { x: 3 })).toBe(2);
  });

  it("supports functions with and without parentheses", () => {
    expect(ev("\\sin(x)", { x: Math.PI / 2 })).toBeCloseTo(1);
    expect(ev("\\sin x", { x: Math.PI / 2 })).toBeCloseTo(1);
    expect(ev("\\sin 2x", { x: Math.PI / 4 })).toBeCloseTo(1);
    expect(ev("\\sin x\\cos x", { x: 0.3 })).toBeCloseTo(Math.sin(0.3) * Math.cos(0.3));
    expect(ev("\\sin^2x+\\cos^2x", { x: 0.7 })).toBeCloseTo(1);
    expect(ev("\\sin^{-1}(1)")).toBeCloseTo(Math.PI / 2);
    expect(ev("\\ln e")).toBeCloseTo(1);
    expect(ev("\\log 100")).toBeCloseTo(2);
    expect(ev("\\log_{2} 8")).toBeCloseTo(3);
    expect(ev("e^{x}", { x: 1 })).toBeCloseTo(Math.E);
    expect(ev("\\exp(1)")).toBeCloseTo(Math.E);
    expect(ev("\\sqrt[3]{-8}")).toBeCloseTo(-2);
    expect(ev("\\left|x\\right|", { x: -4 })).toBe(4);
    expect(ev("|x-3|", { x: 1 })).toBe(2);
  });

  it("understands MathLive output: \\mleft/\\mright, \\operatorname, \\theta", () => {
    expect(ev("\\mleft(x+1\\mright)^2", { x: 1 })).toBe(4);
    expect(ev("\\operatorname{sin}\\theta", { theta: Math.PI / 2 })).toBeCloseTo(1);
    expect(ev("r\\cos\\theta", { r: 2, theta: 0 })).toBe(2);
  });

  it("tolerates roundoff at the edge of a square root's domain", () => {
    // 1 - 0.1^2 - sqrt(0.99)^2 is a hair below zero in floating point.
    const y = Math.sqrt(1 - 0.01);
    expect(ev("\\sqrt{1-x^2-y^2}", { x: 0.1, y })).toBe(0);
    expect(Number.isNaN(ev("\\sqrt{-1}"))).toBe(true);
  });

  it("treats x^{1/3} as the real cube root for negative x", () => {
    expect(ev("x^{1/3}", { x: -8 })).toBeCloseTo(-2);
    expect(Number.isNaN(ev("x^{1/2}", { x: -4 }))).toBe(true);
  });

  it("explains what's wrong", () => {
    expect(errorOf("")).toMatch(/empty/);
    expect(errorOf("\\placeholder{}")).toMatch(/empty box/);
    expect(errorOf("x+")).toMatch(/missing something after/);
    expect(errorOf("(x+1")).toMatch(/closing “\)”/);
    expect(errorOf("x+1)")).toMatch(/extra “\)”/);
    expect(errorOf("\\foo{x}")).toMatch(/\\foo/);
    expect(errorOf("\\sin")).toMatch(/needs something to apply to/);
    expect(errorOf("x=1")).toMatch(/doesn't belong/);
  });
});
