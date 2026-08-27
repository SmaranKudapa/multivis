/**
 * Converts a constrained subset of LaTeX math syntax into a plain string
 * that mathjs's parser can evaluate. This is NOT a general LaTeX parser --
 * it only supports what shows up in calculus integrands and bounds:
 * \frac, \sqrt (with optional degree), ^ exponents, \pi, \infty, \cdot,
 * \times, and a fixed set of function names. The variable alphabet is
 * fixed to x, y, z (see parseIntegral.ts), which is what makes implicit
 * multiplication (e.g. "xy" -> "x*y") safe to auto-insert without
 * mis-tokenizing function names.
 */

// Longest names first so regex alternation doesn't stop early (e.g. "arcsin" before "sin").
const FUNCTION_MAP: Record<string, string> = {
  arcsin: "asin",
  arccos: "acos",
  arctan: "atan",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  sec: "sec",
  csc: "csc",
  cot: "cot",
  ln: "log",
  log: "log10",
  exp: "exp",
  sqrt: "sqrt",
};

const FUNCTION_NAMES_BY_LENGTH = Object.keys(FUNCTION_MAP).sort((a, b) => b.length - a.length);

// A control character that can never appear in real input or in anything
// `transform` generates, used to shield generated function-call text from
// the implicit-multiplication pass (see withProtectedFunctionCalls below).
const PLACEHOLDER = "\u0001";

/** Strips \left, \right, \limits, and LaTeX spacing commands; collapses whitespace. */
export function stripLatexNoise(input: string): string {
  return input
    .replace(/\\left|\\right|\\limits/g, "")
    .replace(/\\(,|;|:|!|quad|qquad| )/g, "")
    .replace(/\s+/g, "");
}

interface Cursor {
  s: string;
  i: number;
}

function atEnd(c: Cursor): boolean {
  return c.i >= c.s.length;
}

/** Reads a brace-delimited group `{...}` (brace-depth aware) or, if there's
 * no opening brace, a single bare atom (one char, or one backslash command). */
function readGroup(c: Cursor): string {
  if (c.s[c.i] === "{" || c.s[c.i] === "(") {
    const open = c.s[c.i];
    const close = open === "{" ? "}" : ")";
    let depth = 1;
    let j = c.i + 1;
    while (j < c.s.length && depth > 0) {
      if (c.s[j] === open) depth++;
      else if (c.s[j] === close) depth--;
      j++;
    }
    const inner = c.s.slice(c.i + 1, j - 1);
    c.i = j;
    return transform(inner);
  }
  if (c.s[c.i] === "\\") {
    let j = c.i + 1;
    while (j < c.s.length && /[a-zA-Z]/.test(c.s[j])) j++;
    const atom = c.s.slice(c.i, j);
    c.i = j;
    return transform(atom);
  }
  const atom = c.s[c.i] ?? "";
  c.i++;
  return transform(atom);
}

function tryReadCommandName(c: Cursor): string | null {
  if (c.s[c.i] !== "\\") return null;
  let j = c.i + 1;
  while (j < c.s.length && /[a-zA-Z]/.test(c.s[j])) j++;
  if (j === c.i + 1) return null; // backslash with no letters (spacing command; already stripped)
  return c.s.slice(c.i + 1, j);
}

/** Recursively converts a noise-stripped LaTeX string into a mathjs-parseable string. */
function transform(input: string): string {
  const c: Cursor = { s: input, i: 0 };
  let out = "";

  while (!atEnd(c)) {
    if (c.s[c.i] === "\\") {
      const cmd = tryReadCommandName(c);
      if (cmd === "frac") {
        c.i += 1 + cmd.length;
        const num = readGroup(c);
        const den = readGroup(c);
        out += `((${num})/(${den}))`;
        continue;
      }
      if (cmd === "sqrt") {
        c.i += 1 + cmd.length;
        if (c.s[c.i] === "[") {
          const close = c.s.indexOf("]", c.i);
          const degree = transform(c.s.slice(c.i + 1, close));
          c.i = close + 1;
          const radicand = readGroup(c);
          out += `(nthRoot(${radicand},${degree}))`;
        } else {
          const radicand = readGroup(c);
          out += `(sqrt(${radicand}))`;
        }
        continue;
      }
      if (cmd === "pi") {
        c.i += 1 + cmd.length;
        out += "pi";
        continue;
      }
      if (cmd === "infty") {
        c.i += 1 + cmd.length;
        out += "Infinity";
        continue;
      }
      if (cmd === "cdot" || cmd === "times") {
        c.i += 1 + cmd.length;
        out += "*";
        continue;
      }
      if (cmd && cmd in FUNCTION_MAP) {
        c.i += 1 + cmd.length;
        const arg = readGroup(c);
        out += `${FUNCTION_MAP[cmd]}(${arg})`;
        continue;
      }
      // Unknown command: drop the backslash, keep the name as-is (best effort).
      if (cmd) {
        c.i += 1 + cmd.length;
        out += cmd;
        continue;
      }
    }

    // Bare (non-backslash) function name, e.g. "sin(x)" typed without a backslash.
    const bareMatch = FUNCTION_NAMES_BY_LENGTH.find((name) => c.s.startsWith(name, c.i));
    if (bareMatch && /[({]/.test(c.s[c.i + bareMatch.length] ?? "")) {
      c.i += bareMatch.length;
      const arg = readGroup(c);
      out += `${FUNCTION_MAP[bareMatch]}(${arg})`;
      continue;
    }

    if (c.s[c.i] === "^") {
      c.i++;
      const exponent = readGroup(c);
      out += `^(${exponent})`;
      continue;
    }

    if (c.s[c.i] === "{") {
      out += `(${readGroup(c)})`;
      continue;
    }

    out += c.s[c.i];
    c.i++;
  }

  return out;
}

function isLetterish(ch: string | undefined): boolean {
  return ch !== undefined && (/[a-zA-Z]/.test(ch) || ch === PLACEHOLDER);
}

/** Inserts `*` between adjacent factors mathjs would otherwise mis-tokenize
 * (e.g. "2x" -> "2*x", "xy" -> "x*y", ")(" -> ")*("). Safe only because the
 * variable alphabet is fixed to x, y, z. */
function insertImplicitMultiplication(s: string): string {
  const isVar = (ch: string | undefined) => ch === "x" || ch === "y" || ch === "z";
  const isDigit = (ch: string | undefined) => ch !== undefined && ch >= "0" && ch <= "9";

  let out = "";
  for (const ch of s) {
    const prev = out.length > 0 ? out[out.length - 1] : undefined;
    if (prev !== undefined) {
      const needsMul =
        (prev === ")" && (isLetterish(ch) || isDigit(ch) || ch === "(")) ||
        (isDigit(prev) && (isLetterish(ch) || ch === "(")) ||
        (isVar(prev) && (isLetterish(ch) || isDigit(ch) || ch === "("));
      if (needsMul) out += "*";
    }
    out += ch;
  }
  return out;
}

/** Protects generated `name(` function-call prefixes from the implicit-
 * multiplication pass by swapping them for a placeholder character,
 * restoring them afterward. Without this, e.g. "exp(" would be corrupted
 * (its "x" would look like our reserved variable, adjacent to "p"). */
function withProtectedFunctionCalls(s: string, run: (protectedStr: string) => string): string {
  const names = Object.values(FUNCTION_MAP)
    .concat(["nthRoot"])
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(?:${names.join("|")})\\(`, "g");
  const restore: string[] = [];
  const protectedStr = s.replace(pattern, (match) => {
    restore.push(match);
    return PLACEHOLDER;
  });
  const result = run(protectedStr);
  let index = 0;
  return result.replace(new RegExp(PLACEHOLDER, "g"), () => restore[index++]);
}

export function latexToMathJs(latex: string): string {
  const stripped = stripLatexNoise(latex);
  const converted = transform(stripped);
  return withProtectedFunctionCalls(converted, insertImplicitMultiplication);
}
