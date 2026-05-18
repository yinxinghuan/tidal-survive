import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// The shark mesh is rendered entirely underwater. We expose a separate
// dorsal-fin mesh that pokes up. Both share the same outer <group> set by
// ActorSync; the fin's y-offset is fixed so it appears just above the water
// plane when the shark is at waterY - 0.25 (per useGameLoop).
export function Shark({ lungingRef }: { lungingRef?: React.MutableRefObject<boolean> }) {
  const wiggle = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    if (wiggle.current) {
      const t = clock.getElapsedTime() * 5 + phase.current;
      const amp = lungingRef?.current ? 0.32 : 0.18;
      wiggle.current.rotation.y = Math.sin(t) * amp;
    }
  });
  return (
    <group ref={wiggle}>
      {/* Body — elongated stretched box, sits slightly under water */}
      <mesh position={[0, 0, 0]} castShadow rotation={[0, 0, 0]}>
        <boxGeometry args={[0.9, 0.5, 2.4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      {/* Belly */}
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.85, 0.18, 2.3]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.8} />
      </mesh>
      {/* Tail fin */}
      <mesh position={[0, 0.05, -1.4]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.45, 0.6, 4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      {/* Pectoral fins */}
      <mesh position={[-0.55, -0.05, 0.1]} rotation={[0, 0, -0.6]}>
        <coneGeometry args={[0.18, 0.6, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      <mesh position={[0.55, -0.05, 0.1]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.18, 0.6, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
      {/* DORSAL FIN — pokes ABOVE the water. The shark's y in state is
          waterY - 0.25, so a fin offset of +0.5 puts the tip ~0.25 above
          the water surface. */}
      <mesh position={[0, 0.55, 0.1]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.22, 0.6, 4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
      </mesh>
    </group>
  );
}
