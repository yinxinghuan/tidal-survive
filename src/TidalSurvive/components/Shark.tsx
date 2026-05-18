import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// The shark mesh is rendered entirely underwater. The dorsal fin pokes above
// the water plane. Lunging mode → bigger fin + faster wiggle so the player
// reads danger before they get bit.
export function Shark({ lungingRef }: { lungingRef?: React.MutableRefObject<boolean> }) {
  const wiggle = useRef<THREE.Group>(null);
  const finRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    const lunging = lungingRef?.current ?? false;
    if (wiggle.current) {
      const t = clock.getElapsedTime() * (lunging ? 8 : 5) + phase.current;
      const amp = lunging ? 0.42 : 0.18;
      wiggle.current.rotation.y = Math.sin(t) * amp;
    }
    if (finRef.current) {
      const target = lunging ? 1.4 : 1.0;
      const s = finRef.current.scale.x;
      const next = s + (target - s) * 0.12;
      finRef.current.scale.setScalar(next);
    }
  });
  return (
    <group ref={wiggle}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 2.4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.85, 0.18, 2.3]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.05, -1.4]}>
        <coneGeometry args={[0.45, 0.6, 4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      <mesh position={[-0.55, -0.05, 0.1]} rotation={[0, 0, -0.6]}>
        <coneGeometry args={[0.18, 0.6, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      <mesh position={[0.55, -0.05, 0.1]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.18, 0.6, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      <group ref={finRef}>
        <mesh position={[0, 0.55, 0.1]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.22, 0.6, 4]} />
          <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}
