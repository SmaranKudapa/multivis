import { parse } from "mathjs";

export type ScalarFn = (scope: Record<string, number>) => number;

export interface CompileResult {
  fn: ScalarFn;
  error: string | null;
}

const KNOWN_CONSTANTS = new Set([
  "pi",
  "e",
  "tau",
  "phi",
  "i",
  "Infinity",
  "LN2",
  "LN10",
  "LOG2E",
  "LOG10E",
  "SQRT1_2",
  "SQRT2",
]);

/**
 * Compiles a plain mathjs expression string (already converted from LaTeX
 * by latexToMathJs) into a callable function. Uses mathjs's own parser and
 * compiled-node evaluator -- never `eval` -- and only resolves variables
 * from `allowedVars` plus a fixed set of known math constants, so a bound
 * expression can't accidentally reference a variable it shouldn't see
 * (e.g. an outer bound referencing an inner integration variable).
 */
export function compileExpression(mathjsExpr: string, allowedVars: string[]): CompileResult {
  const trimmed = mathjsExpr.trim();
  if (trimmed.length === 0) {
    return { fn: () => NaN, error: "Expression is empty." };
  }

  try {
    const node = parse(trimmed);

    let unknownVar: string | null = null;
    node.traverse((n, path) => {
      if (unknownVar) return;
      if (path === "fn") return; // the function name in a FunctionNode, e.g. "sin" in sin(x)
      if (n.type === "SymbolNode") {
        const name = (n as unknown as { name: string }).name;
        if (!allowedVars.includes(name) && !KNOWN_CONSTANTS.has(name)) {
          unknownVar = name;
        }
      }
    });
    if (unknownVar) {
      const allowedList = allowedVars.length > 0 ? allowedVars.join(", ") : "(none)";
      return { fn: () => NaN, error: `Unknown variable "${unknownVar}" (expected one of: ${allowedList}).` };
    }

    const code = node.compile();
    const fn: ScalarFn = (scope) => {
      const result = code.evaluate(scope);
      return typeof result === "number" ? result : NaN;
    };
    return { fn, error: null };
  } catch (err) {
    return { fn: () => NaN, error: err instanceof Error ? err.message : "Invalid expression." };
  }
}
