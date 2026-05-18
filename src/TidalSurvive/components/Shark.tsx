import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// Shark body lives underwater; dorsal fin + wake render above. The V-wake is
// two thin angled meshes streaming backward from the fin, scaled with speed
// so a lunging shark visibly tears the water.
export function Shark({ lungingRef }: { lungingRef?: React.MutableRefObject<boolean> }) {
  const wiggle = useRef<THREE.Group>(null);
  const finRef = useRef<THREE.Group>(null);
  const wakeLeft = useRef<THREE.Mesh>(null);
  const wakeRight = useRef<THREE.Mesh>(null);
  const wakeLeftMat = useRef<THREE.MeshBasicMaterial>(null);
  const wakeRightMat = useRef<THREE.MeshBasicMaterial>(null);
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
    // Wake length + opacity scale with state
    const wakeLen = lunging ? 2.2 : 1.0;
    const wakeOpacity = lunging ? 0.85 : 0.45;
    if (wakeLeft.current) wakeLeft.current.scale.z = wakeLen;
    if (wakeRight.current) wakeRight.current.scale.z = wakeLen;
    if (wakeLeftMat.current) wakeLeftMat.current.opacity += (wakeOpacity - wakeLeftMat.current.opacity) * 0.15;
    if (wakeRightMat.current) wakeRightMat.current.opacity += (wakeOpacity - wakeRightMat.current.opacity) * 0.15;
  });
  return (
    <group ref={wiggle}>
      {/* Body */}
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
      {/* V wake — two streaks angled outward, lying flat just above water (y=0.32 puts them at the water line for a shark whose body is at waterY-0.25). The geometry centers on z=0 and extends in -Z; we apply rotation.y on each side to angle them outward. */}
      <mesh
        ref={wakeLeft}
        position={[-0.24, 0.32, -0.4]}
        rotation={[-Math.PI / 2, 0, -0.35]}
      >
        <planeGeometry args={[0.18, 1.4]} />
        <meshBasicMaterial
          ref={wakeLeftMat}
          color={COLORS.sharkWake}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        ref={wakeRight}
        position={[0.24, 0.32, -0.4]}
        rotation={[-Math.PI / 2, 0, 0.35]}
      >
        <planeGeometry args={[0.18, 1.4]} />
        <meshBasicMaterial
          ref={wakeRightMat}
          color={COLORS.sharkWake}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
