/**
 * Tokenizer for the subset of LaTeX that MathLive (or a person typing raw
 * LaTeX) produces for calculus expressions. Formatting-only commands
 * (\left, \right, spacing, \limits, ...) are dropped here so the parsers
 * never have to think about them; wrapper commands like \mathrm{d} or
 * \operatorname{sin} are collapsed into the single token they stand for.
 *
 * Every token keeps its [start, end) offsets into the original string so an
 * error can point back at the exact LaTeX the user wrote.
 */

export type TokenKind = "num" | "letter" | "cmd" | "sym" | "placeholder" | "d";

export interface Token {
  kind: TokenKind;
  /** num: the digits; letter: the letter; cmd: name without backslash; sym: the character. */
  value: string;
  start: number;
  end: number;
}

const SKIPPED_COMMANDS = new Set([
  "left",
  "right",
  "mleft",
  "mright",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "biggl",
  "biggr",
  "Biggl",
  "Biggr",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "limits",
  "nolimits",
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "quad",
  "qquad",
  "enspace",
  "thinspace",
  "medspace",
  "thickspace",
  "negthinspace",
  "negmedspace",
  "negthickspace",
  "mathstrut",
  "strut",
]);

/** Commands whose braced argument is really just a name: \mathrm{d}, \operatorname{sin}, ... */
const NAME_WRAPPERS = new Set(["mathrm", "operatorname", "mathit", "text", "textrm", "textit", "mathbf", "mathsf"]);

const COMMAND_ALIASES: Record<string, { kind: TokenKind; value: string }> = {
  dfrac: { kind: "cmd", value: "frac" },
  tfrac: { kind: "cmd", value: "frac" },
  cfrac: { kind: "cmd", value: "frac" },
  cdot: { kind: "sym", value: "*" },
  times: { kind: "sym", value: "*" },
  ast: { kind: "sym", value: "*" },
  div: { kind: "sym", value: "/" },
  lvert: { kind: "sym", value: "|" },
  rvert: { kind: "sym", value: "|" },
  vert: { kind: "sym", value: "|" },
  mid: { kind: "sym", value: "|" },
  lbrace: { kind: "sym", value: "(" },
  rbrace: { kind: "sym", value: ")" },
  lparen: { kind: "sym", value: "(" },
  rparen: { kind: "sym", value: ")" },
  lbrack: { kind: "sym", value: "[" },
  rbrack: { kind: "sym", value: "]" },
  differentialD: { kind: "d", value: "d" },
  exponentialE: { kind: "letter", value: "e" },
  vartheta: { kind: "cmd", value: "theta" },
  varrho: { kind: "cmd", value: "rho" },
  varphi: { kind: "cmd", value: "phi" },
  varpi: { kind: "cmd", value: "pi" },
};

const UNICODE_MAP: Record<string, { kind: TokenKind; value: string }> = {
  "θ": { kind: "cmd", value: "theta" },
  "ϑ": { kind: "cmd", value: "theta" },
  "ρ": { kind: "cmd", value: "rho" },
  "φ": { kind: "cmd", value: "phi" },
  "ϕ": { kind: "cmd", value: "phi" },
  "π": { kind: "cmd", value: "pi" },
  "∞": { kind: "cmd", value: "infty" },
  "∫": { kind: "cmd", value: "int" },
  "√": { kind: "cmd", value: "sqrt" },
  "·": { kind: "sym", value: "*" },
  "⋅": { kind: "sym", value: "*" },
  "×": { kind: "sym", value: "*" },
  "÷": { kind: "sym", value: "/" },
  "−": { kind: "sym", value: "-" },
  "–": { kind: "sym", value: "-" },
};

/** Reads a balanced `{...}` group starting at s[i] === "{"; returns the index just past the closing brace. */
function matchBrace(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") {
      j++; // skip escaped char (e.g. \{ )
      continue;
    }
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return s.length;
}

export function tokenize(src: string, offset = 0, out: Token[] = []): Token[] {
  const s = src;
  let i = 0;
  const push = (kind: TokenKind, value: string, start: number, end: number) =>
    out.push({ kind, value, start: start + offset, end: end + offset });

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch) || ch === "~") {
      i++;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      if (s[j] === "." && /[0-9]/.test(s[j + 1] ?? "")) {
        j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      push("num", s.slice(i, j), i, j);
      i = j;
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      push("letter", ch, i, i + 1);
      i++;
      continue;
    }

    if (ch === "\\") {
      const next = s[i + 1];
      if (next === undefined) {
        push("sym", "\\", i, i + 1);
        i++;
        continue;
      }
      if (!/[a-zA-Z]/.test(next)) {
        // Single-character commands: spacing (\, \; \: \! \ ) is dropped, \{ \} act as parens.
        if (next === "{") push("sym", "(", i, i + 2);
        else if (next === "}") push("sym", ")", i, i + 2);
        else if (next === "|") push("sym", "|", i, i + 2);
        else if (!",;:! >".includes(next)) push("sym", next, i, i + 2);
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const name = s.slice(i + 1, j);

      if (SKIPPED_COMMANDS.has(name)) {
        i = j;
        // `\left.` / `\right.` are invisible delimiters.
        if ((name === "left" || name === "right") && s[i] === ".") i++;
        continue;
      }

      if (name === "placeholder") {
        let k = j;
        while (s[k] === " ") k++;
        if (s[k] === "[") {
          const close = s.indexOf("]", k);
          k = close === -1 ? s.length : close + 1;
        }
        while (s[k] === " ") k++;
        if (s[k] === "{") {
          const end = matchBrace(s, k);
          const content = s.slice(k + 1, end - 1);
          if (content.trim().length === 0) push("placeholder", "", i, end);
          else tokenize(content, offset + k + 1, out);
          i = end;
        } else {
          push("placeholder", "", i, k);
          i = k;
        }
        continue;
      }

      if (NAME_WRAPPERS.has(name)) {
        let k = j;
        if (s[k] === "*") k++;
        while (s[k] === " ") k++;
        if (s[k] === "{") {
          const end = matchBrace(s, k);
          const content = s.slice(k + 1, end - 1).replace(/\s+/g, "");
          if (content === "d") push("d", "d", i, end);
          else if (/^[a-zA-Z]{2,}$/.test(content)) push("cmd", content, i, end);
          else if (content.length > 0) tokenize(content, offset + k + 1, out);
          i = end;
          continue;
        }
        i = j;
        continue;
      }

      const alias = COMMAND_ALIASES[name];
      if (alias) push(alias.kind, alias.value, i, j);
      else push("cmd", name, i, j);
      i = j;
      continue;
    }

    const uni = UNICODE_MAP[ch];
    if (uni) {
      push(uni.kind, uni.value, i, i + 1);
      i++;
      continue;
    }

    push("sym", ch, i, i + 1);
    i++;
  }

  return out;
}

/** How a token should be shown in an error message. */
export function describeToken(tok: Token): string {
  switch (tok.kind) {
    case "cmd":
      return `\\${tok.value}`;
    case "placeholder":
      return "an empty box";
    case "d":
      return "d";
    default:
      return tok.value;
  }
}
