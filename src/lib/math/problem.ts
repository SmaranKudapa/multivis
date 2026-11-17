/** A user-facing explanation of what's wrong (or not graphable) and where. */
export interface Problem {
  /** One short line, e.g. "Invalid upper bound of y". */
  title: string;
  /** Plain-language explanation (may contain several sentences). */
  message: string;
  /** Which part of the integral this is about, e.g. "upper bound of y" or "integrand". */
  part?: string;
  /** The LaTeX of that part (as the user wrote it), so the UI can show it rendered. */
  partLatex?: string;
}

export type PartKind = "lower" | "upper" | "integrand" | "structure";

export function partName(kind: PartKind, varDisplay?: string): string {
  if (kind === "integrand") return "integrand";
  if (kind === "structure") return "integral";
  return `${kind} bound of ${varDisplay}`;
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
