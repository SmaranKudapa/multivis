import { ANGLE_VARS, displayVar } from "./coords";

/** Short human-friendly number: 4 significant digits, π-fractions for angles. */
export function formatNumber(v: number, varName?: string): string {
  if (v === Infinity) return "∞";
  if (v === -Infinity) return "−∞";
  if (Number.isNaN(v)) return "undefined";
  if (varName && ANGLE_VARS.has(varName)) {
    const pi = formatPiMultiple(v);
    if (pi) return pi;
  }
  return trimNumber(v, 4);
}

export function trimNumber(v: number, sig: number): string {
  if (v === 0 || Object.is(v, -0)) return "0";
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1e6 || abs < 1e-4) s = v.toExponential(sig - 1).replace(/\.?0+e/, "e");
  else s = Number(v.toPrecision(sig)).toString();
  return s.replace("-", "−");
}

function formatPiMultiple(v: number): string | null {
  if (v === 0) return "0";
  const ratio = v / Math.PI;
  for (const q of [1, 2, 3, 4, 6, 8, 12]) {
    const p = Math.round(ratio * q);
    if (p !== 0 && Math.abs(ratio * q - p) < 1e-9) {
      const sign = p < 0 ? "−" : "";
      const ap = Math.abs(p);
      const num = ap === 1 ? "π" : `${ap}π`;
      return q === 1 ? sign + num : `${sign}${num}/${q}`;
    }
  }
  return null;
}

/** "x = 0.5, y = −0.25" */
export function formatPoint(vars: string[], values: ArrayLike<number>): string {
  return vars.map((v, i) => `${displayVar(v)} = ${formatNumber(values[i], v)}`).join(", ");
}

/** The final integral value: 6 significant digits. */
export function formatResult(v: number): string {
  if (!Number.isFinite(v)) return formatNumber(v);
  if (Math.abs(v) < 1e-12) return "0";
  return trimNumber(v, 6);
}
