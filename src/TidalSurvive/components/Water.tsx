import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYFIELD, WATER_BASE_Y, WATER_Y_PER_LEVEL, COLORS } from '../constants';
import type { GameRef } from '../hooks/useGameLoop';

/**
 * Water surface. y follows state.current.waterLevel each frame.
 * The plane is big enough to fill the whole camera horizon.
 */
export function Water({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const d = stateRef.current;
    meshRef.current.position.y = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    // Subtle UV-less shimmer via emissive intensity wobble
    if (matRef.current) {
      const t = clock.getElapsedTime();
      const k = 0.06 + Math.sin(t * 1.4) * 0.02;
      matRef.current.emissiveIntensity = k;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_BASE_Y, 0]} receiveShadow>
      <planeGeometry args={[PLAYFIELD * 6, PLAYFIELD * 6, 1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color={COLORS.water}
        roughness={0.35}
        metalness={0.15}
        transparent
        opacity={0.92}
        emissive={COLORS.waterFoam}
        emissiveIntensity={0.06}
      />
    </mesh>
  );
}
