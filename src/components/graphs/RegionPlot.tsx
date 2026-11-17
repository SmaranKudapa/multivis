import { useMemo } from "react";
import type { CompiledIntegral } from "../../lib/math/analyze";
import { displayVar } from "../../lib/math/coords";
import { makeRegionMapper, unitSquareLoop, valuesByName, type ViewClip } from "../../lib/graph/region";
import { Plot2D } from "./Plot2D";
import { makeFrame, padBounds } from "../../lib/graph/frame2d";

interface RegionPlotProps {
  integral: CompiledIntegral;
  clips: ViewClip[];
}

const BOUNDARY_SAMPLES = 480;
const SLICES = 9;

/**
 * Double integral: the region of integration drawn in its true plane
 * (xy for polar). Faint lines show the inner variable's sweep at a few
 * fixed values of the outer variable -- i.e. how the iterated integral
 * slices the region.
 */
export function RegionPlot({ integral, clips }: RegionPlotProps) {
  const { system } = integral;

  const data = useMemo(() => {
    const mapper = makeRegionMapper(integral, clips);
    const toPoint = (u: number, v: number) => system.toPoint(valuesByName(integral, mapper([u, v])));

    const boundary: number[][] = [];
    for (let i = 0; i <= BOUNDARY_SAMPLES; i++) {
      const [u, v] = unitSquareLoop((4 * i) / BOUNDARY_SAMPLES);
      boundary.push(toPoint(u, v));
    }
    const slices: number[][][] = [];
    for (let s = 1; s < SLICES; s++) {
      const u = s / SLICES;
      const line: number[][] = [];
      for (let j = 0; j <= 60; j++) line.push(toPoint(u, j / 60));
      slices.push(line);
    }

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const [x, y] of boundary) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    if (!Number.isFinite(xMin)) xMin = xMax = yMin = yMax = 0;
    return { boundary, slices, bounds: padBounds({ xMin, xMax, yMin, yMax }) };
  }, [integral, clips, system]);

  const frame = makeFrame(data.bounds, true);
  const path = (pts: number[][], close: boolean) =>
    pts
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${frame.toX(x).toFixed(2)},${frame.toY(y).toFixed(2)}`)
      .join("") + (close ? "Z" : "");

  const isPolar = system.kind === "polar";
  const [hVar, vVar] = isPolar ? ["x", "y"] : system.axisVars;

  return (
    <Plot2D
      frame={frame}
      xLabel={displayVar(hVar)}
      yLabel={displayVar(vVar)}
      xVar={hVar}
      yVar={vVar}
      label="Region of integration"
    >
      <path d={path(data.boundary, true)} className="region-fill" fillRule="nonzero" />
      {data.slices.map((line, i) => (
        <path key={i} d={path(line, false)} className="region-slice" />
      ))}
      <path d={path(data.boundary, true)} className="region-outline" />
    </Plot2D>
  );
}
