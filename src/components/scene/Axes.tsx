import { Line, Text } from "@react-three/drei";

interface AxesProps {
  size?: number;
}

/** x (red), y (blue), z (green) axis lines and labels, GeoGebra-style. */
export function Axes({ size = 6 }: AxesProps) {
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
    </group>
  );
}
