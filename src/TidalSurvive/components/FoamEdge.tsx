import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYFIELD, WATER_BASE_Y, WATER_Y_PER_LEVEL, COLORS, SHALLOW_PADDING } from '../constants';
import type { GameRef } from '../hooks/useGameLoop';

/**
 * Breaking-waves foam line ringing the island AND a second outer ring marking
 * the deep-water boundary (where sharks become a threat). Both rest at the
 * current water surface y.
 */
export function FoamEdge({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const d = stateRef.current;
    const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    groupRef.current.position.y = waterY + 0.03;
    const t = clock.getElapsedTime();
    if (innerMatRef.current) innerMatRef.current.opacity = 0.55 + Math.sin(t * 1.6) * 0.18;
    if (outerMatRef.current) outerMatRef.current.opacity = 0.30 + Math.sin(t * 1.2 + 1) * 0.10;
  });

  // INNER strips — at the island edge
  const innerStrips = useMemo(() => {
    const halfEdge = PLAYFIELD / 2 + 0.4;
    const t = 0.4;
    return [
      { pos: [0, 0,  halfEdge], scale: [PLAYFIELD + 0.8, t] },
      { pos: [0, 0, -halfEdge], scale: [PLAYFIELD + 0.8, t] },
      { pos: [ halfEdge, 0, 0], scale: [t, PLAYFIELD + 0.8] },
      { pos: [-halfEdge, 0, 0], scale: [t, PLAYFIELD + 0.8] },
    ];
  }, []);
  // OUTER strips — at the shallow / deep-water boundary
  const outerStrips = useMemo(() => {
    const halfEdge = PLAYFIELD / 2 + SHALLOW_PADDING;
    const t = 0.25;
    return [
      { pos: [0, 0,  halfEdge], scale: [PLAYFIELD + 2 * SHALLOW_PADDING + 1, t] },
      { pos: [0, 0, -halfEdge], scale: [PLAYFIELD + 2 * SHALLOW_PADDING + 1, t] },
      { pos: [ halfEdge, 0, 0], scale: [t, PLAYFIELD + 2 * SHALLOW_PADDING + 1] },
      { pos: [-halfEdge, 0, 0], scale: [t, PLAYFIELD + 2 * SHALLOW_PADDING + 1] },
    ];
  }, []);

  return (
    <group ref={groupRef}>
      {innerStrips.map((s, i) => (
        <mesh key={`in-${i}`} position={s.pos as any} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[s.scale[0], s.scale[1]]} />
          <meshBasicMaterial
            ref={i === 0 ? innerMatRef : undefined}
            color={COLORS.foamLine}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {outerStrips.map((s, i) => (
        <mesh key={`out-${i}`} position={s.pos as any} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[s.scale[0], s.scale[1]]} />
          <meshBasicMaterial
            ref={i === 0 ? outerMatRef : undefined}
            color={COLORS.foamLine}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
