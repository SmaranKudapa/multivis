import { describe, expect, it } from "vitest";
import { compileExpression } from "../parser";

describe("compileExpression", () => {
  it("evaluates a basic expression with allowed variables", () => {
    const { fn, error } = compileExpression("x + y", ["x", "y"]);
    expect(error).toBeNull();
    expect(fn({ x: 2, y: 3 })).toBeCloseTo(5);
  });

  it("resolves known constants like pi and e", () => {
    const { fn, error } = compileExpression("pi + e", []);
    expect(error).toBeNull();
    expect(fn({})).toBeCloseTo(Math.PI + Math.E);
  });

  it("does not flag a function name as an unknown variable", () => {
    const { fn, error } = compileExpression("sin(x)", ["x"]);
    expect(error).toBeNull();
    expect(fn({ x: 0 })).toBeCloseTo(0);
  });

  it("rejects a variable outside the allowed list", () => {
    const { error } = compileExpression("x + z", ["x", "y"]);
    expect(error).toMatch(/Unknown variable "z"/);
  });

  it("reports a parse error for invalid syntax", () => {
    const { error } = compileExpression("x + * 2", ["x"]);
    expect(error).not.toBeNull();
  });

  it("reports an error for an empty expression", () => {
    const { error } = compileExpression("   ", []);
    expect(error).toMatch(/empty/);
  });
});
