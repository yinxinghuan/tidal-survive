import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TILE_SIZE, TILE_THICKNESS, GROUND_Y, COLORS } from '../constants';
import { TILE_GROW_ANIM, type GameRef } from '../hooks/useGameLoop';

// Top stack layer animates a scale-in (1.4 → 1.0 over TILE_GROW_ANIM) whenever
// the tile's height grows. We read the latest grow time from the state ref so
// any height change re-triggers the animation without a React re-render.
function GrowLayer({
  height, growAt, color, stateRef,
}: {
  height: number; growAt: number;
  color: string; stateRef: React.MutableRefObject<GameRef>;
}) {
  const ref = useRef<THREE.Group>(null);
  const lastGrow = useRef(growAt);
  useFrame(() => {
    if (!ref.current) return;
    const t = stateRef.current.time;
    const age = t - lastGrow.current;
    if (age < TILE_GROW_ANIM) {
      const p = age / TILE_GROW_ANIM;
      // bouncy ease-out: 1.4 → 0.95 → 1.0
      const s = 1.4 - 0.45 * Math.min(1, p * 1.4) + 0.05 * Math.sin(p * Math.PI * 3) * (1 - p);
      ref.current.scale.set(s, s, s);
    } else {
      ref.current.scale.set(1, 1, 1);
    }
  });
  // If parent passes a fresher growAt, update local ref
  if (growAt !== lastGrow.current) lastGrow.current = growAt;
  const y = GROUND_Y + (height - 1 + 0.5) * TILE_THICKNESS;
  return (
    <group ref={ref} position={[0, y, 0]}>
      <RoundedBox
        args={[TILE_SIZE * 0.92, TILE_THICKNESS, TILE_SIZE * 0.92]}
        radius={0.10} smoothness={3}
        position={[0, 0, 0]}
        castShadow receiveShadow
      >
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
    </group>
  );
}

export function Tile({
  col, row, height, growAt, x, z, stateRef,
}: {
  col: number; row: number; height: number; growAt: number;
  x: number; z: number;
  stateRef: React.MutableRefObject<GameRef>;
}) {
  // All layers below the top are static; only the top one gets the bounce.
  const staticLayers: { y: number; color: string }[] = [];
  for (let i = 0; i < height - 1; i++) {
    const c = i % 2 === 0 ? COLORS.rock : COLORS.rockDark;
    const y = GROUND_Y + (i + 0.5) * TILE_THICKNESS;
    staticLayers.push({ y, color: c });
  }
  const topColor = (height - 1) % 2 === 0 ? COLORS.rock : COLORS.rockDark;

  return (
    <group position={[x, 0, z]}>
      <RoundedBox
        args={[TILE_SIZE * 0.96, TILE_THICKNESS, TILE_SIZE * 0.96]}
        radius={0.08} smoothness={3}
        position={[0, GROUND_Y - TILE_THICKNESS / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={COLORS.sand} roughness={0.9} />
      </RoundedBox>
      {staticLayers.map((l, i) => (
        <RoundedBox
          key={`s-${col}-${row}-${i}`}
          args={[TILE_SIZE * 0.92, TILE_THICKNESS, TILE_SIZE * 0.92]}
          radius={0.10} smoothness={3}
          position={[0, l.y, 0]}
          castShadow receiveShadow
        >
          <meshStandardMaterial color={l.color} roughness={0.85} />
        </RoundedBox>
      ))}
      {height > 0 && (
        <GrowLayer
          height={height}
          growAt={growAt}
          color={topColor}
          stateRef={stateRef}
        />
      )}
    </group>
  );
}
