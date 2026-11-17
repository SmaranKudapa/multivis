import { colormap } from "../../lib/graph/colormap";
import { formatNumber } from "../../lib/math/format";

const STOPS = [0, 0.25, 0.5, 0.75, 1].map((t) => `#${colormap(t).getHexString()} ${t * 100}%`).join(", ");

/** Small gradient bar explaining what the surface colors mean. */
export function ColorLegend({ min, max, label }: { min: number; max: number; label: string }) {
  return (
    <div className="color-legend" aria-label={`Color scale for ${label}`}>
      <span className="color-legend-label">{label}</span>
      <span className="color-legend-value">{formatNumber(min)}</span>
      <span className="color-legend-bar" style={{ background: `linear-gradient(to right, ${STOPS})` }} />
      <span className="color-legend-value">{formatNumber(max)}</span>
    </div>
  );
}
