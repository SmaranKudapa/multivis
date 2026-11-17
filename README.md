# Multivis

Multivis is an interactive visualizer for integrals from multivariable
calculus. Type a single, double or triple integral (Cartesian, polar,
cylindrical or spherical) straight into a math editor, and get its value
plus graphs of the region or solid it describes.

## Using it

- **Start from a template.** The buttons above the editor (Single,
  Double, Triple, Polar, Cylindrical, Spherical) drop in an integral with
  empty boxes. Click a box or press <kbd>Tab</kbd> to jump between them.
  The polar, cylindrical and spherical templates already include the
  Jacobian (r, or ρ² sin φ).
- **Or just type.** The editor is a visual math field (MathLive), so you
  edit the rendered integral directly. Handy shortcuts: `int` → ∫ with
  bound boxes, `/` → fraction, `^` → power, `sqrt` → √, `pi` → π,
  `theta` / `rho` / `phi` → θ / ρ / φ, `oo` → ∞. On touch devices a math
  keyboard appears.
- **Examples** shows ready-made integrals for each kind.
- **Show LaTeX** reveals the underlying LaTeX if you want to copy or paste
  it. Editing it updates the editor too.

### What you get

| Integral | Graphs |
| --- | --- |
| Single | The curve with the signed area shaded (blue above the axis, red below) |
| Double (Cartesian or polar) | The region in the plane (with dashed slices showing the inner integral), and the solid under the surface. The surface height is the integrand (divided by r for polar), so the volume shown equals the integral |
| Triple (Cartesian, cylindrical, spherical) | The solid, colored by density if the integrand ÷ volume element varies |

3D views auto-scale to fit. If one axis has to be stretched to keep the
picture readable, the view says so. Infinite regions are clipped to a
finite window, with a note saying where.

### When something's wrong

Multivis never graphs an integral that isn't valid. It explains what's
wrong and **which part** (a specific bound, the integrand, or the
structure). Some examples:

- an empty box, a syntax error, or an unknown command
- a bound that uses the wrong variable (e.g. the bound for `y` using
  `y` or `z`, or non-constant outermost bounds)
- a bound that's undefined over part of the region, with the exact
  interval, e.g. "√(1−x²) can't be evaluated when x is between 1 and 2"
- an integrand that's undefined inside the region, with a point
- an integral that diverges

If an upper bound is **smaller** than its lower bound, the integral is
mathematically legal as a signed integral, so Multivis shows its value.
But it explains that the bounds don't describe a real region, says where
they cross, and shows no graph.

## Writing integrals

- Each ∫ needs a lower bound (`_`) and an upper bound (`^`), and there's
  one differential per ∫ at the end, innermost first: `dz dy dx`.
- The rightmost differential is the outermost variable. Its bounds must
  be numbers. Inner bounds can use any variable further out.
- Supported coordinate systems, detected from the differentials:
  - single: `dx`, `dy` or `dz`
  - double: any two of `dx dy dz`, or `dr dθ` (polar)
  - triple: `dx dy dz`, `dz dr dθ` (cylindrical), `dρ dφ dθ` (spherical,
    φ measured from the +z axis)
- Supported math: `+ − × ÷`, fractions, powers, `√` and n-th roots,
  `sin cos tan sec csc cot`, their inverses (`\arcsin` or `\sin^{-1}`),
  `sinh cosh tanh`, `ln`, `log` (base 10) and `\log_b`, `exp`, `|x|`,
  `π`, `e`, `∞`, and implicit multiplication (`2x`, `xy`, `x(y+1)`).

Values are computed with tanh-sinh quadrature. It handles singular
endpoints (like 1/√x) and infinite bounds, and usually gives 10+ correct
digits.

## Running it locally

```bash
npm install
npm run dev
```

Other commands:

```bash
npm test        # unit tests
npm run lint
npm run build   # production build into dist/
```

## Deploying (Vercel)

The repo includes a `vercel.json` (Vite preset, output `dist/`). Import the
GitHub repository in Vercel once, and every push to `main` deploys.
Pull requests get preview URLs.

## Code map

- `src/lib/math/`: everything numeric, with no React. That's the
  tokenizer, LaTeX expression parser and compiler, integral structure
  parser, coordinate systems, quadrature, and the `analyzeIntegral`
  pipeline that validates and computes.
- `src/lib/graph/`: geometry helpers: region mapping, infinite-region
  clipping, surfaces, scaling.
- `src/components/`: the editor, result panel and graphs (SVG for 2D,
  react-three-fiber for 3D).
