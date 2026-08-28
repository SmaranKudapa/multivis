import { useMemo } from "react";
import type { EvaluatedLevel } from "../lib/evaluateIntegral";
import { sampleTypeIBoundary } from "../lib/regionBoundary";
import { computeNiceTicks } from "../lib/niceTicks";

interface BoundsVisual2DProps {
  levels: EvaluatedLevel[];
}

const WIDTH = 320;
const HEIGHT = 320;
const PADDING = 32;

export function BoundsVisual2D({ levels }: BoundsVisual2DProps) {
  const [outer, inner] = levels;

  const { polygonPoints, axes, xTicks, yTicks } = useMemo(() => {
    const outerMin = outer.lowerFn({});
    const outerMax = outer.upperFn({});
    const lowerAt = (o: number) => inner.lowerFn({ [outer.varName]: o });
    const upperAt = (o: number) => inner.upperFn({ [outer.varName]: o });

    const boundary = sampleTypeIBoundary(outerMin, outerMax, lowerAt, upperAt, 120);

    // Include the origin so the axes are always in frame, even if the region doesn't touch it.
    let outerLo = Math.min(outerMin, 0);
    let outerHi = Math.max(outerMax, 0);
    let innerLo = 0;
    let innerHi = 0;
    for (const p of boundary) {
      innerLo = Math.min(innerLo, p.inner);
      innerHi = Math.max(innerHi, p.inner);
    }
    if (outerHi === outerLo) outerHi = outerLo + 1;
    if (innerHi === innerLo) innerHi = innerLo + 1;

    const availableW = WIDTH - 2 * PADDING;
    const availableH = HEIGHT - 2 * PADDING;
    const scale = Math.min(availableW / (outerHi - outerLo), availableH / (innerHi - innerLo));

    const usedW = (outerHi - outerLo) * scale;
    const usedH = (innerHi - innerLo) * scale;
    const offsetX = PADDING + (availableW - usedW) / 2;
    const offsetY = PADDING + (availableH - usedH) / 2;

    const toSvgX = (o: number) => offsetX + (o - outerLo) * scale;
    const toSvgY = (v: number) => HEIGHT - offsetY - (v - innerLo) * scale;

    const xTicks = computeNiceTicks(outerLo, outerHi).map((value) => ({ value, pos: toSvgX(value) }));
    const yTicks = computeNiceTicks(innerLo, innerHi).map((value) => ({ value, pos: toSvgY(value) }));

    return {
      polygonPoints: boundary.map((p) => `${toSvgX(p.outer)},${toSvgY(p.inner)}`).join(" "),
      axes: {
        x1: toSvgX(outerLo),
        x2: toSvgX(outerHi),
        y1: toSvgY(innerLo),
        y2: toSvgY(innerHi),
        originX: toSvgX(0),
        originY: toSvgY(0),
      },
      xTicks,
      yTicks,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outer, inner]);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bounds-svg" role="img" aria-label="Integration region bounds">
      <line x1={axes.x1} y1={axes.originY} x2={axes.x2} y2={axes.originY} stroke="#e0645c" strokeWidth={1.5} />
      <line x1={axes.originX} y1={axes.y1} x2={axes.originX} y2={axes.y2} stroke="#5b8fe0" strokeWidth={1.5} />

      {xTicks.map(({ value, pos }) => (
        <g key={`x-${value}`}>
          <line x1={pos} y1={axes.originY - 4} x2={pos} y2={axes.originY + 4} stroke="#e0645c" strokeWidth={1} />
          {value !== 0 && (
            <text x={pos} y={axes.originY + 16} fontSize={10} fill="#874442" textAnchor="middle">
              {formatTick(value)}
            </text>
          )}
        </g>
      ))}
      {yTicks.map(({ value, pos }) => (
        <g key={`y-${value}`}>
          <line x1={axes.originX - 4} y1={pos} x2={axes.originX + 4} y2={pos} stroke="#5b8fe0" strokeWidth={1} />
          {value !== 0 && (
            <text x={axes.originX - 8} y={pos + 3} fontSize={10} fill="#375a8c" textAnchor="end">
              {formatTick(value)}
            </text>
          )}
        </g>
      ))}

      <text x={axes.x2 - 4} y={axes.originY - 6} fontSize={12} fill="#e0645c" textAnchor="end">
        {outer.varName}
      </text>
      <text x={axes.originX + 6} y={axes.y2 + 12} fontSize={12} fill="#5b8fe0">
        {inner.varName}
      </text>
      <polygon points={polygonPoints} fill="rgba(79,131,204,0.25)" stroke="#4f83cc" strokeWidth={2} />
    </svg>
  );
}

function formatTick(value: number): string {
  return Number(value.toFixed(6)).toString();
}
