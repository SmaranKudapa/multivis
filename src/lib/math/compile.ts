import type { Node } from "./expression";

/** A compiled expression. `v[i]` is the value of the variable at index i (see compile()). */
export type CompiledFn = (v: ArrayLike<number>) => number;

/** Values within this distance below zero are treated as zero by sqrt, even roots and fractional powers. */
const ROUNDOFF = 1e-12;

/**
 * Numeric helpers that are slightly more forgiving than raw Math.* about
 * floating-point roundoff: at the edge of a region like y = √(1−x²), the
 * radicand can come out as −1e−17 instead of 0, which would otherwise turn
 * a perfectly valid boundary point into NaN.
 */
const helpers = {
  sqrt(t: number): number {
    if (t < 0 && t > -ROUNDOFF) return 0;
    return Math.sqrt(t);
  },
  pow(a: number, b: number): number {
    if (a >= 0 || Number.isInteger(b)) return Math.pow(a, b);
    if (a > -ROUNDOFF) return Math.pow(0, b);
    // Negative base, fractional exponent: real only for p/q with odd q, e.g. x^{1/3}.
    const q = oddDenominator(b);
    if (q === null) return NaN;
    const p = Math.round(b * q);
    const magnitude = Math.pow(-a, b);
    return p % 2 === 0 ? magnitude : -magnitude;
  },
  root(a: number, n: number): number {
    if (!Number.isInteger(n) || n <= 0) return helpers.pow(a, 1 / n);
    if (a >= 0) return Math.pow(a, 1 / n);
    if (n % 2 === 1) return -Math.pow(-a, 1 / n);
    return a > -ROUNDOFF ? 0 : NaN;
  },
  ln(t: number): number {
    return t > 0 ? Math.log(t) : t === 0 ? -Infinity : NaN;
  },
  log10(t: number): number {
    return t > 0 ? Math.log10(t) : t === 0 ? -Infinity : NaN;
  },
  logb(base: number, t: number): number {
    if (base <= 0 || base === 1) return NaN;
    return helpers.ln(t) / Math.log(base);
  },
  asin(t: number): number {
    return Math.asin(clampUnit(t));
  },
  acos(t: number): number {
    return Math.acos(clampUnit(t));
  },
};

function clampUnit(t: number): number {
  if (t > 1 && t < 1 + ROUNDOFF) return 1;
  if (t < -1 && t > -1 - ROUNDOFF) return -1;
  return t;
}

/** If b ≈ p/q in lowest terms with q odd and small, returns q; otherwise null. */
function oddDenominator(b: number): number | null {
  for (let q = 1; q <= 15; q += 2) {
    const p = Math.round(b * q);
    if (Math.abs(p / q - b) < 1e-12) return q;
  }
  return null;
}

function numberLiteral(v: number): string {
  if (v === Infinity) return "Infinity";
  if (v === -Infinity) return "(-Infinity)";
  return `(${String(v)})`;
}

function emit(node: Node, indexOf: (name: string) => number): string {
  switch (node.k) {
    case "num":
      return numberLiteral(node.v);
    case "var":
      return `v[${indexOf(node.name)}]`;
    case "neg":
      return `(-${emit(node.a, indexOf)})`;
    case "add":
      return `(${emit(node.a, indexOf)}+${emit(node.b, indexOf)})`;
    case "sub":
      return `(${emit(node.a, indexOf)}-${emit(node.b, indexOf)})`;
    case "mul":
      return `(${emit(node.a, indexOf)}*${emit(node.b, indexOf)})`;
    case "div":
      return `(${emit(node.a, indexOf)}/${emit(node.b, indexOf)})`;
    case "pow":
      return `h.pow(${emit(node.a, indexOf)},${emit(node.b, indexOf)})`;
    case "root":
      return `h.root(${emit(node.a, indexOf)},${emit(node.n, indexOf)})`;
    case "logb":
      return `h.logb(${emit(node.base, indexOf)},${emit(node.a, indexOf)})`;
    case "fn": {
      const a = emit(node.a, indexOf);
      switch (node.name) {
        case "sin":
        case "cos":
        case "tan":
        case "sinh":
        case "cosh":
        case "tanh":
        case "exp":
        case "abs":
          return `Math.${node.name}(${a})`;
        case "sec":
          return `(1/Math.cos(${a}))`;
        case "csc":
          return `(1/Math.sin(${a}))`;
        case "cot":
          return `(1/Math.tan(${a}))`;
        case "arcsin":
          return `h.asin(${a})`;
        case "arccos":
          return `h.acos(${a})`;
        case "arctan":
          return `Math.atan(${a})`;
        case "ln":
          return `h.ln(${a})`;
        case "log":
          return `h.log10(${a})`;
        case "sqrt":
          return `h.sqrt(${a})`;
      }
    }
  }
}

/**
 * Compiles an AST into a JavaScript function. The generated source is built
 * only from whitelisted pieces (numeric literals, `v[i]` lookups, operators
 * and fixed helper calls), so it's safe to hand to `new Function` -- and it
 * runs ~10x faster than walking the tree, which matters for triple
 * integrals that evaluate the integrand around a million times.
 *
 * `variables` fixes the index of each variable name in the `v` argument.
 * Every variable in the AST must be in that list (callers validate this
 * first and produce a friendly error otherwise).
 */
export function compile(node: Node, variables: readonly string[]): CompiledFn {
  const indexOf = (name: string) => {
    const idx = variables.indexOf(name);
    if (idx === -1) throw new Error(`compile: unknown variable ${name}`);
    return idx;
  };
  const body = emit(node, indexOf);
  const factory = new Function("h", `"use strict"; return function (v) { return ${body}; };`) as (h: typeof helpers) => CompiledFn;
  return factory(helpers);
}

/** True when the expression doesn't depend on any variable. */
export function isConstant(node: Node): boolean {
  switch (node.k) {
    case "num":
      return true;
    case "var":
      return false;
    case "neg":
    case "fn":
      return isConstant(node.a);
    case "root":
      return isConstant(node.n) && isConstant(node.a);
    case "logb":
      return isConstant(node.base) && isConstant(node.a);
    default:
      return isConstant(node.a) && isConstant(node.b);
  }
}
