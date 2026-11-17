import type { ReactNode } from "react";
import { computeNiceTicks } from "../../lib/graph/niceTicks";
import { formatNumber } from "../../lib/math/format";
import { AXIS_COLORS, NEUTRAL_AXIS, SIZE, type Frame2D } from "../../lib/graph/frame2d";

interface Plot2DProps {
  frame: Frame2D;
  xLabel: string;
  yLabel: string;
  xVar?: string;
  yVar?: string;
  label: string;
  children: ReactNode;
}

/** SVG chart frame: axes through the origin, nice ticks, and axis names. Content goes in `children`. */
export function Plot2D({ frame, xLabel, yLabel, xVar, yVar, label, children }: Plot2DProps) {
  const { toX, toY, bounds } = frame;
  const xColor = (xVar && AXIS_COLORS[xVar]) || NEUTRAL_AXIS;
  const yColor = (yVar && AXIS_COLORS[yVar]) || NEUTRAL_AXIS;
  const originX = toX(Math.min(Math.max(0, bounds.xMin), bounds.xMax));
  const originY = toY(Math.min(Math.max(0, bounds.yMin), bounds.yMax));
  const xTicks = computeNiceTicks(bounds.xMin, bounds.xMax, 6);
  const yTicks = computeNiceTicks(bounds.yMin, bounds.yMax, 6);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="plot-svg" role="img" aria-label={label}>
      {/* light grid */}
      {xTicks.map((t) => (
        <line key={`gx${t}`} x1={toX(t)} x2={toX(t)} y1={toY(bounds.yMin)} y2={toY(bounds.yMax)} className="plot-grid" />
      ))}
      {yTicks.map((t) => (
        <line key={`gy${t}`} y1={toY(t)} y2={toY(t)} x1={toX(bounds.xMin)} x2={toX(bounds.xMax)} className="plot-grid" />
      ))}

      {children}

      <line x1={toX(bounds.xMin)} x2={toX(bounds.xMax)} y1={originY} y2={originY} stroke={xColor} strokeWidth={1.5} />
      <line y1={toY(bounds.yMin)} y2={toY(bounds.yMax)} x1={originX} x2={originX} stroke={yColor} strokeWidth={1.5} />

      {xTicks.map((t) =>
        t === 0 ? null : (
          <g key={`tx${t}`}>
            <line x1={toX(t)} x2={toX(t)} y1={originY - 3} y2={originY + 3} stroke={xColor} />
            <text x={toX(t)} y={originY + 14} className="plot-tick" textAnchor="middle">
              {formatNumber(t)}
            </text>
          </g>
        ),
      )}
      {yTicks.map((t) =>
        t === 0 ? null : (
          <g key={`ty${t}`}>
            <line y1={toY(t)} y2={toY(t)} x1={originX - 3} x2={originX + 3} stroke={yColor} />
            <text x={originX - 6} y={toY(t) + 3.5} className="plot-tick" textAnchor="end">
              {formatNumber(t)}
            </text>
          </g>
        ),
      )}

      <text x={SIZE - 6} y={originY - 7} className="plot-axis-label" fill={xColor} textAnchor="end">
        {xLabel}
      </text>
      <text x={originX + 7} y={14} className="plot-axis-label" fill={yColor}>
        {yLabel}
      </text>
    </svg>
  );
}
