import { useId, useMemo } from "react";
import type { CompiledIntegral } from "../../lib/math/analyze";
import { displayVar } from "../../lib/math/coords";
import type { ViewClip } from "../../lib/graph/region";
import { Plot2D } from "./Plot2D";
import { makeFrame, padBounds } from "../../lib/graph/frame2d";

interface CurvePlotProps {
  integral: CompiledIntegral;
  clips: ViewClip[];
}

const SAMPLES = 400;

/** Single integral: the curve y = f(x) with the signed area between it and the axis shaded. */
export function CurvePlot({ integral, clips }: CurvePlotProps) {
  const clipId = useId();
  const v = integral.levels[0].varName;

  const data = useMemo(() => {
    const clamp = (t: number) => Math.min(Math.max(t, clips[0].lo), clips[0].hi);
    const a = clamp(integral.levels[0].lower([]));
    const b = clamp(integral.levels[0].upper([]));
    const f = (x: number) => integral.integrand([x]);

    // Show the curve a little beyond the bounds (dashed) for context.
    const ext = (b - a) * 0.15;
    const ea = a - ext;
    const eb = b + ext;

    const inside: [number, number][] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = a + ((b - a) * i) / SAMPLES;
      inside.push([x, f(x)]);
    }
    const outside: [number, number][][] = [[], []];
    for (let i = 0; i <= 40; i++) {
      outside[0].push([ea + ((a - ea) * i) / 40, f(ea + ((a - ea) * i) / 40)]);
      outside[1].push([b + ((eb - b) * i) / 40, f(b + ((eb - b) * i) / 40)]);
    }

    // Robust y-range: ignore non-finite values and extreme spikes near singular endpoints.
    const ys = inside.map(([, y]) => y).filter(Number.isFinite).sort((p, q) => p - q);
    const lo = ys.length ? ys[Math.floor(ys.length * 0.01)] : 0;
    const hi = ys.length ? ys[Math.ceil(ys.length * 0.99) - 1] : 1;
    const bounds = padBounds({ xMin: ea, xMax: eb, yMin: Math.min(lo, 0), yMax: Math.max(hi, 0) });
    return { inside, outside, bounds, a, b };
  }, [integral, clips]);

  const frame = makeFrame(data.bounds, false);
  const { toX, toY, bounds } = frame;
  const yCap = (y: number) => Math.min(Math.max(y, bounds.yMin - 1e3 * (bounds.yMax - bounds.yMin)), bounds.yMax + 1e3 * (bounds.yMax - bounds.yMin));

  const toPath = (pts: [number, number][]) => {
    let d = "";
    let pen = false;
    for (const [x, y] of pts) {
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${toX(x).toFixed(2)},${toY(yCap(y)).toFixed(2)}`;
      pen = true;
    }
    return d;
  };

  const finiteInside = data.inside.filter(([, y]) => Number.isFinite(y));
  const area =
    finiteInside.length > 1
      ? `M${toX(data.a)},${toY(0)} ` + finiteInside.map(([x, y]) => `L${toX(x).toFixed(2)},${toY(yCap(y)).toFixed(2)}`).join("") + ` L${toX(data.b)},${toY(0)} Z`
      : "";

  const zeroY = toY(0);
  const shown = displayVar(v);

  return (
    <Plot2D frame={frame} xLabel={shown} yLabel={`f(${shown})`} xVar={v} label={`Graph of the integrand over ${shown}`}>
      <defs>
        <clipPath id={`${clipId}-pos`}>
          <rect x={0} y={0} width={9999} height={Math.max(0, zeroY)} />
        </clipPath>
        <clipPath id={`${clipId}-neg`}>
          <rect x={0} y={zeroY} width={9999} height={9999} />
        </clipPath>
        <clipPath id={`${clipId}-plot`}>
          <rect x={toX(bounds.xMin)} y={toY(bounds.yMax)} width={toX(bounds.xMax) - toX(bounds.xMin)} height={toY(bounds.yMin) - toY(bounds.yMax)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId}-plot)`}>
        <path d={area} className="area-positive" clipPath={`url(#${clipId}-pos)`} />
        <path d={area} className="area-negative" clipPath={`url(#${clipId}-neg)`} />
        <line x1={toX(data.a)} x2={toX(data.a)} y1={zeroY} y2={toY(yCap(data.inside[0][1]) || 0)} className="bound-line" />
        <line x1={toX(data.b)} x2={toX(data.b)} y1={zeroY} y2={toY(yCap(data.inside[data.inside.length - 1][1]) || 0)} className="bound-line" />
        <path d={toPath(data.outside[0])} className="curve curve--context" />
        <path d={toPath(data.outside[1])} className="curve curve--context" />
        <path d={toPath(data.inside)} className="curve" />
      </g>
    </Plot2D>
  );
}
