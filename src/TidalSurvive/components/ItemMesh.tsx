import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../constants';
import type { ItemKind } from '../types';

/**
 * Items dressed to be unmistakable from the camera angle:
 *   plank   — wood-grain board with 2 dark grain lines
 *   boulder — wooden barrel (cylinder + 2 metal bands)
 *   paddle  — long shaft + large flat blade
 *
 * `highlight` (true during tutorial pickup) paints a gold ring under the item.
 */
export function ItemMesh({ kind, highlight = false }: { kind: ItemKind; highlight?: boolean }) {
  const highlightRingMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!highlight || !highlightRingMat.current) return;
    const t = clock.getElapsedTime();
    highlightRingMat.current.opacity = 0.55 + Math.sin(t * 3) * 0.25;
  });
  const ring = highlight ? (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
      <ringGeometry args={[0.75, 0.95, 32]} />
      <meshBasicMaterial ref={highlightRingMat} color="#ffe17a" transparent opacity={0.65} />
    </mesh>
  ) : null;

  if (kind === 'plank') {
    return (
      <group>
        {ring}
        <RoundedBox args={[1.6, 0.20, 0.55]} radius={0.05} smoothness={3} castShadow>
          <meshStandardMaterial color={COLORS.plank} roughness={0.85} />
        </RoundedBox>
        {/* Dark grain lines */}
        <mesh position={[0, 0.11, -0.14]}>
          <boxGeometry args={[1.55, 0.014, 0.026]} />
          <meshStandardMaterial color={COLORS.plankDark} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.11, 0.10]}>
          <boxGeometry args={[1.55, 0.014, 0.026]} />
          <meshStandardMaterial color={COLORS.plankDark} roughness={0.85} />
        </mesh>
        {/* Nails (gold pinpoints at corners) */}
        {[[-0.7, 0.20], [0.7, 0.20], [-0.7, -0.20], [0.7, -0.20]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.11, z]}>
            <cylinderGeometry args={[0.026, 0.026, 0.04, 8]} />
            <meshStandardMaterial color="#c9a35a" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'boulder') {
    return (
      <group>
        {ring}
        {/* Wooden barrel — replaces the dodecahedron rock so the silhouette is
            instantly readable as "heavy salvage". */}
        <mesh castShadow position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.85, 12]} />
          <meshStandardMaterial color="#7a4823" roughness={0.9} />
        </mesh>
        {/* Metal bands */}
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 0.08, 12, 1, true]} />
          <meshStandardMaterial color="#3a3530" metalness={0.5} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.10, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 0.08, 12, 1, true]} />
          <meshStandardMaterial color="#3a3530" metalness={0.5} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* Lid line */}
        <mesh position={[0, 0.60, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.0, 0.44, 16]} />
          <meshStandardMaterial color="#5a3818" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
  // Paddle — long shaft + clear blade for legibility
  return (
    <group rotation={[0.55, 0, 0.2]}>
      {ring}
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 1.2, 10]} />
        <meshStandardMaterial color={COLORS.paddle} roughness={0.75} />
      </mesh>
      {/* Big flat blade — visibly oar-shaped */}
      <mesh castShadow position={[0, -0.35, 0]}>
        <boxGeometry args={[0.55, 0.75, 0.06]} />
        <meshStandardMaterial color={COLORS.paddleBlade} roughness={0.7} />
      </mesh>
      {/* Center spine on the blade */}
      <mesh position={[0, -0.35, 0.04]}>
        <boxGeometry args={[0.06, 0.65, 0.02]} />
        <meshStandardMaterial color="#5e3e1c" roughness={0.7} />
      </mesh>
    </group>
  );
}
