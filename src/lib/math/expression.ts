import { describeToken, type Token } from "./tokenize";

/**
 * Recursive-descent parser for calculus expressions written in LaTeX
 * (integrands and integral bounds). Produces a small AST that compile.ts
 * turns into a fast numeric function.
 *
 * Grammar, loosely:
 *   sum     := product (("+" | "-") product)*
 *   product := unary (("*" | "/") unary | <implicit> power)*
 *   unary   := ("-" | "+") unary | power
 *   power   := primary ("^" atom)?
 *   primary := number | variable | constant | "(" sum ")" | "{" sum "}" | "|" sum "|"
 *            | \frac atom atom | \sqrt[n]? atom | function
 * Implicit multiplication (2x, xy, 2\sin x, (x+1)(x-1)) is supported.
 */

export type FnName =
  | "sin"
  | "cos"
  | "tan"
  | "sec"
  | "csc"
  | "cot"
  | "arcsin"
  | "arccos"
  | "arctan"
  | "sinh"
  | "cosh"
  | "tanh"
  | "ln"
  | "log"
  | "exp"
  | "abs"
  | "sqrt";

export type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "add" | "sub" | "mul" | "div" | "pow"; a: Node; b: Node }
  | { k: "fn"; name: FnName; a: Node }
  | { k: "root"; n: Node; a: Node }
  | { k: "logb"; base: Node; a: Node };

const FUNCTIONS = new Set<string>([
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "ln",
  "log",
  "exp",
  "abs",
]);

const INVERSES: Record<string, FnName> = { sin: "arcsin", cos: "arccos", tan: "arctan" };

/** Greek/command spellings of variables -> canonical variable name. */
const GREEK_VARS: Record<string, string> = { theta: "theta", rho: "rho", phi: "phi" };

export class ExpressionError extends Error {
  /** The token the problem was found at, when there is one. */
  readonly token?: Token;
  constructor(message: string, token?: Token) {
    super(message);
    this.token = token;
  }
}

export const SUPPORTED_SYNTAX_HINT =
  "Supported: + − × ÷, fractions, powers, √, sin/cos/tan (and sec, csc, cot, inverses, sinh/cosh/tanh), ln, log, exp, |x|, π, e and ∞.";

class Parser {
  private toks: Token[];
  private i = 0;
  private absDepth = 0;

  constructor(tokens: Token[]) {
    this.toks = tokens.slice();
  }

  private peek(offset = 0): Token | undefined {
    return this.toks[this.i + offset];
  }

  private isSym(tok: Token | undefined, value: string): boolean {
    return tok !== undefined && tok.kind === "sym" && tok.value === value;
  }

  parseAll(): Node {
    if (this.toks.length === 0) throw new ExpressionError("This part is empty.");
    const node = this.sum();
    const extra = this.peek();
    if (extra) {
      if (this.isSym(extra, ")") || this.isSym(extra, "]") || this.isSym(extra, "}")) {
        throw new ExpressionError(`There's an extra “${extra.value}” with no matching opening bracket.`, extra);
      }
      if (this.isSym(extra, "=") || this.isSym(extra, "<") || this.isSym(extra, ">") || (extra.kind === "cmd" && /^(le|leq|ge|geq|ne|neq)$/.test(extra.value))) {
        throw new ExpressionError(`“${describeToken(extra)}” doesn't belong in an integral — only expressions are allowed.`, extra);
      }
      throw new ExpressionError(`Didn't expect “${describeToken(extra)}” here.`, extra);
    }
    return node;
  }

  private sum(): Node {
    let left = this.unary();
    for (;;) {
      const tok = this.peek();
      if (this.isSym(tok, "+") || this.isSym(tok, "-")) {
        this.i++;
        this.requireOperand(tok!);
        const right = this.product();
        left = { k: tok!.value === "+" ? "add" : "sub", a: left, b: right };
      } else {
        return left;
      }
    }
  }

  /** A product that starts after a binary + or - (so it can't itself take a leading sign... except it can: x + -y). */
  private product(): Node {
    return this.productFrom(this.unary());
  }

  private productFrom(first: Node): Node {
    let left = first;
    for (;;) {
      const tok = this.peek();
      if (this.isSym(tok, "*") || this.isSym(tok, "/")) {
        this.i++;
        this.requireOperand(tok!);
        // Just one (optionally signed) factor, so a/b/c stays (a/b)/c.
        const right = this.signedFactor();
        left = { k: tok!.value === "*" ? "mul" : "div", a: left, b: right };
      } else if (this.startsImplicitFactor(tok)) {
        const right = this.power();
        left = { k: "mul", a: left, b: right };
      } else {
        return left;
      }
    }
  }

  private unary(): Node {
    const tok = this.peek();
    if (this.isSym(tok, "-")) {
      this.i++;
      this.requireOperand(tok!);
      return { k: "neg", a: this.productFrom(this.power()) };
    }
    if (this.isSym(tok, "+")) {
      this.i++;
      this.requireOperand(tok!);
      return this.unary();
    }
    return this.productFrom(this.power());
  }

  private signedFactor(): Node {
    const tok = this.peek();
    if (this.isSym(tok, "-")) {
      this.i++;
      this.requireOperand(tok!);
      return { k: "neg", a: this.signedFactor() };
    }
    if (this.isSym(tok, "+")) {
      this.i++;
      this.requireOperand(tok!);
      return this.signedFactor();
    }
    return this.power();
  }

  private requireOperand(op: Token) {
    const next = this.peek();
    if (!next || this.isSym(next, ")") || this.isSym(next, "]") || this.isSym(next, "}") || (this.isSym(next, "|") && this.absDepth > 0)) {
      throw new ExpressionError(`“${op.value}” is missing something after it.`, op);
    }
    if (this.isSym(next, "+") || this.isSym(next, "*") || this.isSym(next, "/") || this.isSym(next, "^")) {
      throw new ExpressionError(`“${op.value}” is followed by another operator “${next.value}”.`, next);
    }
  }

  private startsImplicitFactor(tok: Token | undefined): boolean {
    if (!tok) return false;
    switch (tok.kind) {
      case "num":
      case "letter":
      case "placeholder":
      case "d":
        return true;
      case "cmd":
        return tok.value !== "int" && tok.value !== "iint" && tok.value !== "iiint" ? true : false;
      case "sym":
        return tok.value === "(" || tok.value === "[" || tok.value === "{" || (tok.value === "|" && this.absDepth === 0);
    }
  }

  private power(): Node {
    const base = this.primary();
    return this.maybeExponent(base);
  }

  private maybeExponent(base: Node): Node {
    const tok = this.peek();
    if (this.isSym(tok, "^")) {
      this.i++;
      const exponent = this.scriptArgument(tok!);
      const result: Node = { k: "pow", a: base, b: exponent };
      if (this.isSym(this.peek(), "^")) {
        throw new ExpressionError("Two exponents in a row — wrap one in braces, like x^{2^{3}}.", this.peek());
      }
      return result;
    }
    if (this.isSym(tok, "_")) {
      throw new ExpressionError("Subscripts aren't supported here.", tok);
    }
    return base;
  }

  /**
   * The argument of ^, \frac, \sqrt: a braced group, or (LaTeX-style) a
   * single token. A bare multi-digit number only contributes its first
   * digit, exactly as LaTeX renders it: x^23 means x²·3.
   */
  private scriptArgument(owner: Token): Node {
    const tok = this.peek();
    if (!tok) throw new ExpressionError(`“${describeToken(owner)}” is missing its argument.`, owner);
    if (this.isSym(tok, "{")) {
      this.i++;
      if (this.isSym(this.peek(), "}")) throw new ExpressionError(`“${describeToken(owner)}” has an empty argument.`, owner);
      const inner = this.sum();
      this.expectClose("}", tok);
      return inner;
    }
    if (tok.kind === "num" && tok.value.length > 1) {
      // Split "23" into "2" (consumed) and "3" (left for the caller).
      const first = tok.value[0];
      this.toks[this.i] = { ...tok, value: tok.value.slice(1), start: tok.start + 1 };
      return { k: "num", v: Number(first) };
    }
    if (this.isSym(tok, "-")) {
      // Not valid LaTeX, but x^-1 is a common thing to type into the raw box.
      this.i++;
      return { k: "neg", a: this.scriptArgument(owner) };
    }
    return this.primary();
  }

  private expectClose(close: string, open: Token) {
    const tok = this.peek();
    if (!this.isSym(tok, close)) {
      if (tok) throw new ExpressionError(`Expected a closing “${close}” before “${describeToken(tok)}”.`, tok);
      throw new ExpressionError(`Missing a closing “${close}” to match the “${open.value}”.`, open);
    }
    this.i++;
  }

  private primary(): Node {
    const tok = this.peek();
    if (!tok) throw new ExpressionError("The expression ends too early — something is missing at the end.");
    this.i++;

    switch (tok.kind) {
      case "num":
        return { k: "num", v: Number(tok.value) };
      case "letter":
        if (tok.value === "e") return { k: "num", v: Math.E };
        return { k: "var", name: tok.value };
      case "d":
        return { k: "var", name: "d" };
      case "placeholder":
        throw new ExpressionError("There's an empty box here — fill it in.", tok);
      case "sym":
        return this.symbolPrimary(tok);
      case "cmd":
        return this.commandPrimary(tok);
    }
  }

  private symbolPrimary(tok: Token): Node {
    if (tok.value === "(" || tok.value === "[" || tok.value === "{") {
      const close = tok.value === "(" ? ")" : tok.value === "[" ? "]" : "}";
      if (this.isSym(this.peek(), close)) throw new ExpressionError(`Empty brackets “${tok.value}${close}”.`, tok);
      const savedAbs = this.absDepth;
      this.absDepth = 0;
      const inner = this.sum();
      this.absDepth = savedAbs;
      this.expectClose(close, tok);
      return inner;
    }
    if (tok.value === "|") {
      if (this.isSym(this.peek(), "|")) throw new ExpressionError("Empty absolute value bars “||”.", tok);
      this.absDepth++;
      const inner = this.sum();
      this.absDepth--;
      this.expectClose("|", tok);
      return { k: "fn", name: "abs", a: inner };
    }
    if (tok.value === ")" || tok.value === "]" || tok.value === "}") {
      throw new ExpressionError(`There's an extra “${tok.value}” with no matching opening bracket.`, tok);
    }
    if (tok.value === "^") throw new ExpressionError("An exponent “^” needs something before it.", tok);
    if (tok.value === "*" || tok.value === "/") throw new ExpressionError(`“${tok.value}” needs something before it.`, tok);
    if (tok.value === "!") throw new ExpressionError("Factorials aren't supported.", tok);
    if (tok.value === "=" || tok.value === "<" || tok.value === ">") {
      throw new ExpressionError(`“${tok.value}” doesn't belong in an integral — only expressions are allowed.`, tok);
    }
    throw new ExpressionError(`Didn't expect “${tok.value}” here.`, tok);
  }

  private commandPrimary(tok: Token): Node {
    const name = tok.value;
    if (name === "pi") return { k: "num", v: Math.PI };
    if (name === "infty") return { k: "num", v: Infinity };
    if (name in GREEK_VARS) return { k: "var", name: GREEK_VARS[name] };
    if (name === "frac") {
      const num = this.scriptArgument(tok);
      const den = this.scriptArgument(tok);
      return { k: "div", a: num, b: den };
    }
    if (name === "sqrt") {
      if (this.isSym(this.peek(), "[")) {
        const open = this.peek()!;
        this.i++;
        const degree = this.sum();
        this.expectClose("]", open);
        return { k: "root", n: degree, a: this.scriptArgument(tok) };
      }
      return { k: "fn", name: "sqrt", a: this.scriptArgument(tok) };
    }
    if (FUNCTIONS.has(name)) return this.functionCall(tok);
    if (name === "int" || name === "iint" || name === "iiint") {
      throw new ExpressionError("An integral sign can't appear here — integral signs must all come first, before the integrand.", tok);
    }
    if (name === "le" || name === "leq" || name === "ge" || name === "geq" || name === "ne" || name === "neq") {
      throw new ExpressionError(`“\\${name}” doesn't belong in an integral — only expressions are allowed.`, tok);
    }
    throw new ExpressionError(`“\\${name}” isn't something Multivis understands. ${SUPPORTED_SYNTAX_HINT}`, tok);
  }

  private functionCall(tok: Token): Node {
    let name = tok.value as FnName;
    let outerPower: Node | null = null;
    let logBase: Node | null = null;

    // \log_{2} x
    if (name === "log" && this.isSym(this.peek(), "_")) {
      const underscore = this.peek()!;
      this.i++;
      logBase = this.scriptArgument(underscore);
    }
    // \sin^2 x  -> (sin x)^2;  \sin^{-1} x -> arcsin x
    if (this.isSym(this.peek(), "^")) {
      const caret = this.peek()!;
      this.i++;
      const exponent = this.scriptArgument(caret);
      const isMinusOne = exponent.k === "neg" && exponent.a.k === "num" && exponent.a.v === 1;
      if (isMinusOne && name in INVERSES) name = INVERSES[name];
      else outerPower = exponent;
    }

    const next = this.peek();
    if (!next || !this.startsImplicitFactor(next)) {
      throw new ExpressionError(`\\${tok.value} needs something to apply to, like \\${tok.value}(x).`, tok);
    }

    let arg: Node;
    if (this.isSym(next, "(") || this.isSym(next, "[") || this.isSym(next, "{")) {
      arg = this.primary();
    } else {
      // No brackets: \sin 2x means sin(2x), \sin x \cos x means sin(x)·cos(x).
      arg = this.power();
      while (this.startsImplicitFactor(this.peek()) && !this.isFunctionStart(this.peek()) && !this.isSym(this.peek(), "(")) {
        arg = { k: "mul", a: arg, b: this.power() };
      }
    }

    let node: Node = logBase ? { k: "logb", base: logBase, a: arg } : { k: "fn", name, a: arg };
    if (outerPower) node = { k: "pow", a: node, b: outerPower };
    return node;
  }

  private isFunctionStart(tok: Token | undefined): boolean {
    return tok !== undefined && tok.kind === "cmd" && (FUNCTIONS.has(tok.value) || tok.value === "sqrt" || tok.value === "frac");
  }
}

export function parseExpression(tokens: Token[]): Node {
  return new Parser(tokens).parseAll();
}

/** Every variable name the expression refers to. */
export function freeVariables(node: Node, out = new Set<string>()): Set<string> {
  switch (node.k) {
    case "num":
      break;
    case "var":
      out.add(node.name);
      break;
    case "neg":
    case "fn":
      freeVariables(node.a, out);
      break;
    case "root":
      freeVariables(node.n, out);
      freeVariables(node.a, out);
      break;
    case "logb":
      freeVariables(node.base, out);
      freeVariables(node.a, out);
      break;
    default:
      freeVariables(node.a, out);
      freeVariables(node.b, out);
  }
  return out;
}
