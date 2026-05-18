import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { TILE_SIZE, TILE_THICKNESS, GROUND_Y, COLORS } from '../constants';

// A tile is the bare sand at level 0 PLUS a stack of `height` blocks on top.
// The bottom sand layer is rendered with the same RoundedBox idiom; stack
// layers are tinted progressively rocky as they rise.
export function Tile({
  col, row, height, x, z,
}: { col: number; row: number; height: number; x: number; z: number }) {
  // Bottom sand layer: sits at WATER_BASE_Y, slightly thicker so it reads as terrain
  // floor not block. height >= 1 layers are stacked above.
  const layers = useMemo(() => {
    const arr: { y: number; color: string }[] = [];
    for (let i = 0; i < height; i++) {
      // Alternate stone-ish tones based on layer index for a "pile of rocks" look
      const c = i % 2 === 0 ? COLORS.rock : COLORS.rockDark;
      const y = GROUND_Y + (i + 0.5) * TILE_THICKNESS;
      arr.push({ y, color: c });
    }
    return arr;
  }, [height]);

  const sandTop = COLORS.sand;

  return (
    <group position={[x, 0, z]}>
      {/* Base sand layer — its top is at GROUND_Y, so the player stands at y=0. */}
      <RoundedBox
        args={[TILE_SIZE * 0.96, TILE_THICKNESS, TILE_SIZE * 0.96]}
        radius={0.08} smoothness={3}
        position={[0, GROUND_Y - TILE_THICKNESS / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={sandTop} roughness={0.9} />
      </RoundedBox>
      {/* Stack layers */}
      {layers.map((l, i) => (
        <RoundedBox
          key={`${col}-${row}-${i}`}
          args={[TILE_SIZE * 0.92, TILE_THICKNESS, TILE_SIZE * 0.92]}
          radius={0.10} smoothness={3}
          position={[0, l.y, 0]}
          castShadow receiveShadow
        >
          <meshStandardMaterial color={l.color} roughness={0.85} />
        </RoundedBox>
      ))}
    </group>
  );
}
