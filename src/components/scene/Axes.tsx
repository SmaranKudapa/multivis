import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import { computeNiceTicks } from "../../lib/niceTicks";

interface AxesProps {
  size?: number;
}

function formatTick(value: number): string {
  return Number(value.toFixed(6)).toString();
}

/** x (red), y (blue), z (green) axis lines, labels, and numeric tick marks, GeoGebra-style. */
export function Axes({ size = 6 }: AxesProps) {
  const ticks = useMemo(() => computeNiceTicks(-size, size, 6).filter((t) => t !== 0), [size]);

  return (
    <group>
      <Line points={[[-size, 0, 0], [size, 0, 0]]} color="#e0645c" lineWidth={1.5} />
      <Line points={[[0, 0, -size], [0, 0, size]]} color="#5b8fe0" lineWidth={1.5} />
      <Line points={[[0, -size, 0], [0, size, 0]]} color="#5ec26a" lineWidth={1.5} />

      <Text position={[size + 0.3, 0, 0]} fontSize={0.35} color="#e0645c">
        x
      </Text>
      <Text position={[0, 0, size + 0.3]} fontSize={0.35} color="#5b8fe0">
        y
      </Text>
      <Text position={[0, size + 0.3, 0]} fontSize={0.35} color="#5ec26a">
        z
      </Text>

      {ticks.map((t) => (
        <Text key={`x-${t}`} position={[t, -0.25, 0.25]} fontSize={0.22} color="#874442" anchorX="center">
          {formatTick(t)}
        </Text>
      ))}
      {ticks.map((t) => (
        <Text key={`y-${t}`} position={[0.25, -0.25, t]} fontSize={0.22} color="#375a8c" anchorX="center">
          {formatTick(t)}
        </Text>
      ))}
      {ticks.map((t) => (
        <Text key={`z-${t}`} position={[0.3, t, 0.3]} fontSize={0.22} color="#3f7a49" anchorX="center">
          {formatTick(t)}
        </Text>
      ))}
    </group>
  );
}
