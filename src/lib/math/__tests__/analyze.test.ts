import { describe, expect, it } from "vitest";
import { analyzeIntegral, type Analysis } from "../analyze";

const raw = String.raw;

function valueOf(latex: string): number {
  const r = analyzeIntegral(latex);
  if (r.status !== "ok") throw new Error(`expected ok, got ${r.status}: ${"problem" in r ? r.problem?.message : ""}`);
  return r.value;
}

function problemOf(latex: string): Extract<Analysis, { status: "error" }>["problem"] {
  const r = analyzeIntegral(latex);
  if (r.status !== "error") throw new Error(`expected error, got ${r.status}`);
  return r.problem;
}

describe("analyzeIntegral: values", () => {
  it.each([
    ["single", raw`\int_0^{\pi}\sin x\,dx`, 2],
    ["endpoint singularity", raw`\int_0^1 \frac{1}{\sqrt{x}}\,dx`, 2],
    ["improper", raw`\int_1^\infty \frac{1}{x^2}\,dx`, 1],
    ["unit disk area", raw`\int_{-1}^{1}\int_{-\sqrt{1-x^2}}^{\sqrt{1-x^2}} 1\,dy\,dx`, Math.PI],
    ["paraboloid over disk", raw`\int_{-1}^{1}\int_{-\sqrt{1-x^2}}^{\sqrt{1-x^2}} x^2+y^2\,dy\,dx`, Math.PI / 2],
    ["dx dy order", raw`\int_0^1\int_0^{y} x\,dx\,dy`, 1 / 6],
    ["Gaussian over the plane", raw`\int_{-\infty}^{\infty}\int_{-\infty}^{\infty}e^{-x^2-y^2}dy\,dx`, Math.PI],
    ["polar disk", raw`\int_0^{2\pi}\int_0^1 r\,dr\,d\theta`, Math.PI],
    ["cardioid", raw`\int_0^{2\pi}\int_0^{1+\cos\theta} r\,dr\,d\theta`, 1.5 * Math.PI],
    ["tetrahedron", raw`\int_0^1\int_0^{1-x}\int_0^{1-x-y} 1\,dz\,dy\,dx`, 1 / 6],
    ["exp cube", raw`\int_0^1\int_0^1\int_0^1 e^{x+y+z}\,dz\,dy\,dx`, Math.pow(Math.E - 1, 3)],
    ["ball (Cartesian)", raw`\int_{-1}^{1}\int_{-\sqrt{1-x^2}}^{\sqrt{1-x^2}}\int_{-\sqrt{1-x^2-y^2}}^{\sqrt{1-x^2-y^2}} 1\,dz\,dy\,dx`, (4 / 3) * Math.PI],
    ["ball (spherical)", raw`\int_0^{2\pi}\int_0^{\pi}\int_0^1 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta`, (4 / 3) * Math.PI],
    ["cylinder (cylindrical)", raw`\int_0^{2\pi}\int_0^1\int_0^2 r\,dz\,dr\,d\theta`, 2 * Math.PI],
    ["MathLive-style LaTeX", raw`\int_0^1\!\int_0^{x}\mleft(x+y\mright)\,\mathrm{d}y\,\differentialD x`, 0.5],
    ["empty integrand means 1", raw`\int_0^2\int_0^3 dy\,dx`, 6],
  ])("%s", (_label, latex, expected) => {
    expect(valueOf(latex)).toBeCloseTo(expected, 7);
  });
});

describe("analyzeIntegral: invalid integrals say which part is wrong", () => {
  it("unfilled template boxes", () => {
    const p = problemOf(raw`\int_{\placeholder{}}^{1}\int_0^1 x\,dy\,dx`);
    expect(p.part).toBe("lower bound of x");
    expect(p.title).toMatch(/Fill in/);
  });

  it("syntax errors in the integrand", () => {
    const p = problemOf(raw`\int_0^1\int_0^1 x+\,dy\,dx`);
    expect(p.part).toBe("integrand");
  });

  it("missing or mismatched differentials", () => {
    expect(problemOf(raw`\int_0^1\int_0^1 x`).title).toMatch(/Missing differentials/);
    expect(problemOf(raw`\int_0^1\int_0^1 x\,dx`).title).toMatch(/don't match/);
    expect(problemOf(raw`\int_0^1\int_0^1 x\,dx\,dx`).title).toMatch(/Repeated/);
  });

  it("unsupported coordinate combinations", () => {
    expect(problemOf(raw`\int_0^1\int_0^1 1\,dr\,dx`).message).toMatch(/polar/);
  });

  it("indefinite integrals", () => {
    expect(problemOf(raw`\int\int_0^1 1\,dy\,dx`).title).toMatch(/no bounds/);
  });

  it("bounds that depend on the wrong variable", () => {
    expect(problemOf(raw`\int_0^1\int_0^{y} 1\,dy\,dx`).message).toMatch(/can't depend on y itself/);
    expect(problemOf(raw`\int_0^{y}\int_0^{1} 1\,dy\,dx`).message).toMatch(/outermost integral \(x\) have to be numbers/);
    expect(problemOf(raw`\int_0^1\int_0^{z}\int_0^1 1\,dz\,dy\,dx`).message).toMatch(/can't use z/);
    expect(problemOf(raw`\int_0^1\int_0^{a} 1\,dy\,dx`).message).toMatch(/“a” isn't a variable/);
  });

  it("a bound undefined over part of the outer range, with the exact interval", () => {
    const p = problemOf(raw`\int_{-2}^{2}\int_0^{\sqrt{1-x^2}} 1\,dy\,dx`);
    expect(p.part).toBe("upper bound of y");
    expect(p.message).toContain("x is between −2 and −1");
    expect(p.message).toContain("x is between 1 and 2");
  });

  it("an integrand undefined inside the region", () => {
    const p = problemOf(raw`\int_0^2\int_0^1 \sqrt{x-1}\,dy\,dx`);
    expect(p.part).toBe("integrand");
    expect(p.title).toMatch(/undefined inside the region/);
  });

  it("divergent integrals", () => {
    expect(problemOf(raw`\int_0^1 \frac{1}{x}\,dx`).title).toMatch(/diverges/);
    expect(problemOf(raw`\int_1^\infty \frac{1}{x}\,dx`).title).toMatch(/diverges/);
    expect(problemOf(raw`\int_0^1\int_0^1 \frac{1}{x}\,dy\,dx`).title).toMatch(/diverges/);
  });

  it("infinite angle bounds", () => {
    expect(problemOf(raw`\int_0^{\infty}\int_0^1 r\,dr\,d\theta`).title).toMatch(/angle/);
  });
});

describe("analyzeIntegral: legal but not graphable", () => {
  it("bounds that cross part-way: signed value plus where they cross", () => {
    const r = analyzeIntegral(raw`\int_{-1}^{1}\int_0^{x} 1\,dy\,dx`);
    expect(r.status).toBe("ungraphable");
    if (r.status !== "ungraphable") return;
    expect(r.value).toBeCloseTo(0, 9);
    expect(r.problem?.message).toContain("x is between −1 and 0");
    expect(r.problem?.message).toMatch(/mathematically legal/);
  });

  it("reversed outer bounds flip the sign", () => {
    const r = analyzeIntegral(raw`\int_1^0\int_0^1 1\,dy\,dx`);
    expect(r.status).toBe("ungraphable");
    if (r.status === "ungraphable") expect(r.value).toBeCloseTo(-1, 9);
  });
});

describe("analyzeIntegral: warnings", () => {
  it("reminds about the Jacobian when the integrand lacks r", () => {
    const r = analyzeIntegral(raw`\int_0^{2\pi}\int_0^1 1\,dr\,d\theta`);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.warnings.join(" ")).toMatch(/dA = r dr dθ/);
  });

  it("records infinite ranges for graph clipping", () => {
    const r = analyzeIntegral(raw`\int_0^\infty e^{-x}\,dx`);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.ranges[0].hasPosInf).toBe(true);
  });
});
