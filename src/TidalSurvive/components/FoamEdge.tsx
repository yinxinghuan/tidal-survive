import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYFIELD, WATER_BASE_Y, WATER_Y_PER_LEVEL, COLORS } from '../constants';
import type { GameRef } from '../hooks/useGameLoop';

/**
 * Breaking-waves foam line ringing the island. A thin torus that sits at the
 * water surface y, with an emissive shader-like material that ripples its
 * opacity via a sine to read as "waves breaking".
 *
 * Radius is anchored to PLAYFIELD/2 so it hugs the square island. Not a true
 * conformal foam, but visually unmistakable as "island edge".
 */
export function FoamEdge({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const d = stateRef.current;
    const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    // Sit just above the water surface so it reads as foam crest.
    groupRef.current.position.y = waterY + 0.03;
    if (matRef.current) {
      const t = clock.getElapsedTime();
      matRef.current.opacity = 0.55 + Math.sin(t * 1.6) * 0.18;
    }
  });

  // Build a square-ish foam ribbon by combining 4 thin strips along each edge.
  const strips = useMemo(() => {
    const halfEdge = PLAYFIELD / 2 + 0.4;
    const t = 0.4; // strip thickness
    return [
      { pos: [0, 0,  halfEdge], scale: [PLAYFIELD + 0.8, t] },
      { pos: [0, 0, -halfEdge], scale: [PLAYFIELD + 0.8, t] },
      { pos: [ halfEdge, 0, 0], scale: [t, PLAYFIELD + 0.8] },
      { pos: [-halfEdge, 0, 0], scale: [t, PLAYFIELD + 0.8] },
    ];
  }, []);

  return (
    <group ref={groupRef}>
      {strips.map((s, i) => (
        <mesh key={i} position={s.pos as any} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[s.scale[0], s.scale[1]]} />
          <meshBasicMaterial
            ref={i === 0 ? matRef : undefined}
            color={COLORS.foamLine}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
