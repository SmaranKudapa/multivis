# Multivis

Multivis is an interactive visualizer for multivariable calculus. Type a
double or triple integral in LaTeX, and see it rendered as proper math
notation alongside a computed value and graphs of the region or solid it
describes.

**Try it live:** https://smarankudapa.github.io/multivis/

## Using it

There's one text box. Type an integral in LaTeX, and everything else
updates as you type. Two buttons above the formula (**Sample 2D
integral**, **Sample 3D integral**) fill the box with a working example if
you just want to see it in action first.

- The formula renders below the box, in proper math notation.
- The computed value (area/volume, or a weighted total if your integrand
  isn't 1) appears underneath.
- **Bounds Vis** and **Shape Vis** show two different views, and what
  they show depends on whether you typed a double or triple integral:
  - **Double integral:** Bounds Vis is the 2D region your bounds
    describe; Shape Vis is the surface/volume above it in 3D.
  - **Triple integral:** a triple integral's bounds already describe a 3D
    solid directly (there's no separate 2D region, and no "surface" the
    way a double integral has one), so Bounds Vis shows that solid, and
    Shape Vis is disabled.

If your bounds don't describe a valid region (e.g. an upper bound that's
actually less than the lower bound), you'll get an error message instead
of a graph.

## Writing an integral

Double and triple integrals both work — Multivis tells them apart by
counting how many `\int` signs you write, so no separate mode switch is
needed:

```
\int_{0}^{1}\int_{x^2}^{\sqrt{x}} 1 \, dy\, dx
```

```
\int_{0}^{1}\int_{0}^{1-x}\int_{0}^{1-x-y} 1 \, dz\, dy\, dx
```

A few things worth knowing:

- **Variables must be `x`, `y`, or `z`.** Each one can only appear in one
  differential (`dx`, `dy`, `dz`), and you need exactly as many
  differentials as `\int` signs.
- **The differentials decide which variable is "outer."** The bound that's
  paired with the *last* differential (rightmost, e.g. `dx` in `dy\,dx`) is
  the outermost — its bounds must be constants. Earlier differentials'
  bounds can depend on the outer variable(s). This means both
  `\int_a^b\int_{g(x)}^{h(x)} f \, dy\,dx` and
  `\int_c^d\int_{g(y)}^{h(y)} f \, dx\,dy` work correctly.
- **Bounds can be bare or braced:** `\int_0^1` and `\int_{0}^{1}` both
  work.
- **Supported syntax:** `\frac{}{}`, `\sqrt{}` and `\sqrt[n]{}`, exponents
  (`x^2`, `x^{2}`), `\sin \cos \tan \sec \csc \cot`, `\ln`, `\log` (base
  10), `\exp`, `\pi`, `\infty`, `\cdot`/`\times`, and implicit
  multiplication (`2x`, `xy`, `x(y+1)`).

### More examples to try

```
\int_{-1}^{1}\int_{-\sqrt{1-x^2}}^{\sqrt{1-x^2}} x^2+y^2 \, dy\, dx
```

```
\int_{0}^{1}\int_{0}^{1}\int_{0}^{1} xyz \, dz\, dy\, dx
```

## Running it locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in your terminal.

Other useful commands:

```bash
npm test    # run the unit test suite
npm run build   # production build
```
