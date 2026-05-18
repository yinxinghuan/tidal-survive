import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRef } from '../hooks/useGameLoop';

/**
 * Ambient gull silhouettes — V-shaped sprites that orbit far above and
 * around the island. Pure ambience, no gameplay role.
 */
export function Birds({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const refs = useRef<Map<number, THREE.Group>>(new Map());
  useFrame(() => {
    const d = stateRef.current;
    for (const b of d.birds) {
      const g = refs.current.get(b.id);
      if (!g) continue;
      const x = Math.cos(b.angle) * b.radius;
      const z = Math.sin(b.angle) * b.radius;
      g.position.set(x, b.height, z);
      g.rotation.y = b.angle + Math.PI / 2;
    }
  });
  return (
    <>
      {stateRef.current.birds.map(b => (
        <group key={`bird_${b.id}`} ref={el => {
          if (el) refs.current.set(b.id, el);
          else refs.current.delete(b.id);
        }}>
          {/* Wing 1 */}
          <mesh rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.6, 0.03, 0.18]} />
            <meshStandardMaterial color="#10202c" />
          </mesh>
          <mesh rotation={[0, 0, -0.4]} position={[0, 0, 0]}>
            <boxGeometry args={[0.6, 0.03, 0.18]} />
            <meshStandardMaterial color="#10202c" />
          </mesh>
        </group>
      ))}
    </>
  );
}
