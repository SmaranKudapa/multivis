/** Data-to-SVG mapping for the 2D plots. */

export const SIZE = 360;
export const PAD = 34;

export const AXIS_COLORS: Record<string, string> = {
  x: "#d9534f",
  y: "#3f9b4f",
  z: "#3f6fd9",
};
export const NEUTRAL_AXIS = "#6b7280";

export interface Bounds2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Frame2D {
  toX: (x: number) => number;
  toY: (y: number) => number;
  bounds: Bounds2D;
}

/** Grows bounds to include the origin and a little padding; avoids zero-size ranges. */
export function padBounds(b: Bounds2D, includeOrigin = true): Bounds2D {
  let { xMin, xMax, yMin, yMax } = b;
  if (includeOrigin) {
    xMin = Math.min(xMin, 0);
    xMax = Math.max(xMax, 0);
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  if (!(xMax > xMin)) {
    xMin -= 1;
    xMax += 1;
  }
  if (!(yMax > yMin)) {
    yMin -= 1;
    yMax += 1;
  }
  const px = (xMax - xMin) * 0.06;
  const py = (yMax - yMin) * 0.06;
  return { xMin: xMin - px, xMax: xMax + px, yMin: yMin - py, yMax: yMax + py };
}

/** Maps data coordinates into the SVG square. With `equal`, one unit is the same length on both axes. */
export function makeFrame(b: Bounds2D, equal: boolean): Frame2D {
  const avail = SIZE - 2 * PAD;
  let sx = avail / (b.xMax - b.xMin);
  let sy = avail / (b.yMax - b.yMin);
  if (equal) sx = sy = Math.min(sx, sy);
  const offX = PAD + (avail - (b.xMax - b.xMin) * sx) / 2;
  const offY = PAD + (avail - (b.yMax - b.yMin) * sy) / 2;
  const visible: Bounds2D = {
    xMin: b.xMin - (offX - PAD) / sx,
    xMax: b.xMax + (offX - PAD) / sx,
    yMin: b.yMin - (offY - PAD) / sy,
    yMax: b.yMax + (offY - PAD) / sy,
  };
  return {
    toX: (x) => offX + (x - b.xMin) * sx,
    toY: (y) => SIZE - offY - (y - b.yMin) * sy,
    bounds: visible,
  };
}
