import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// Shark — v1.8 visual rework. Goals:
//   • clearly reads as a shark even at top-down camera angles
//   • tapered nose forward (not just a box)
//   • two-tone body: dark gray TOP / pale belly UNDER
//   • upright dorsal fin pokes above water
//   • crescent caudal (tail) fin in the vertical plane
//   • pectoral fins angled outward
//   • visible single eye + mouth line on each side
//   • V-wake trail unchanged from v1.2
//
// Body axis is +Z (forward), so rotation.y from useGameLoop steers the head.
// Body length 2.6 (slightly elongated), width 0.7, depth 0.55.
export function Shark({ lungingRef }: { lungingRef?: React.MutableRefObject<boolean> }) {
  const wiggle = useRef<THREE.Group>(null);
  const finRef = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Group>(null);
  const wakeLeft = useRef<THREE.Mesh>(null);
  const wakeRight = useRef<THREE.Mesh>(null);
  const wakeLeftMat = useRef<THREE.MeshBasicMaterial>(null);
  const wakeRightMat = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const lunging = lungingRef?.current ?? false;
    if (wiggle.current) {
      const t = clock.getElapsedTime() * (lunging ? 7 : 4) + phase.current;
      const amp = lunging ? 0.36 : 0.14;
      wiggle.current.rotation.y = Math.sin(t) * amp;
    }
    if (finRef.current) {
      const target = lunging ? 1.35 : 1.0;
      const s = finRef.current.scale.x;
      const next = s + (target - s) * 0.12;
      finRef.current.scale.setScalar(next);
    }
    if (jawRef.current) {
      // Open the jaw a bit when lunging — visible "biting" mode.
      const t = clock.getElapsedTime() * 12 + phase.current;
      const open = lunging ? (0.06 + Math.abs(Math.sin(t)) * 0.05) : 0;
      jawRef.current.rotation.x = open;
    }
    const wakeLen = lunging ? 2.4 : 1.0;
    const wakeOpacity = lunging ? 0.9 : 0.4;
    if (wakeLeft.current) wakeLeft.current.scale.z = wakeLen;
    if (wakeRight.current) wakeRight.current.scale.z = wakeLen;
    if (wakeLeftMat.current) wakeLeftMat.current.opacity += (wakeOpacity - wakeLeftMat.current.opacity) * 0.15;
    if (wakeRightMat.current) wakeRightMat.current.opacity += (wakeOpacity - wakeRightMat.current.opacity) * 0.15;
  });

  return (
    <group ref={wiggle}>
      {/* === BODY === elongated, dark top, narrower at the tail */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.7, 0.42, 1.8]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
      </mesh>
      {/* Belly — pale, slightly wider in middle so a sliver shows from the side */}
      <mesh position={[0, -0.20, 0]}>
        <boxGeometry args={[0.74, 0.22, 1.7]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>
      {/* Tapered NOSE — short cone pointing forward (+Z) */}
      <mesh position={[0, 0.0, 1.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.34, 0.7, 12]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
      </mesh>
      {/* Pale underside of nose */}
      <mesh position={[0, -0.16, 1.05]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.30, 0.6, 12]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>
      {/* Lower jaw — separate group rotated to slightly open when lunging */}
      <group ref={jawRef} position={[0, -0.12, 0.75]}>
        <mesh>
          <boxGeometry args={[0.42, 0.05, 0.45]} />
          <meshStandardMaterial color={'#1a232a'} roughness={0.7} />
        </mesh>
        {/* Tiny tooth strip */}
        <mesh position={[0, 0.03, 0.18]}>
          <boxGeometry args={[0.40, 0.02, 0.04]} />
          <meshStandardMaterial color={'#ffffff'} roughness={0.4} />
        </mesh>
      </group>
      {/* Eyes — small dark spheres on either side of the nose */}
      <mesh position={[-0.22, 0.10, 0.55]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={'#0b1116'} roughness={0.3} />
      </mesh>
      <mesh position={[0.22, 0.10, 0.55]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={'#0b1116'} roughness={0.3} />
      </mesh>
      {/* Tiny white eye highlights */}
      <mesh position={[-0.20, 0.13, 0.59]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color={'#ffffff'} />
      </mesh>
      <mesh position={[0.24, 0.13, 0.59]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color={'#ffffff'} />
      </mesh>
      {/* Gill slits — three thin lines on each side */}
      {[-0.05, 0.05, 0.15].map((zOff, i) => (
        <mesh key={`gillL_${i}`} position={[-0.36, 0.0, zOff]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.02, 0.20, 0.025]} />
          <meshStandardMaterial color={'#1d2730'} roughness={0.6} />
        </mesh>
      ))}
      {[-0.05, 0.05, 0.15].map((zOff, i) => (
        <mesh key={`gillR_${i}`} position={[0.36, 0.0, zOff]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.02, 0.20, 0.025]} />
          <meshStandardMaterial color={'#1d2730'} roughness={0.6} />
        </mesh>
      ))}
      {/* === TAIL === crescent: vertical upper lobe + smaller lower lobe */}
      <mesh position={[0, 0.30, -1.05]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.40, 0.95, 4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.30, -0.95]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.30, 0.65, 4]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
      </mesh>
      {/* === PECTORAL FINS === flat triangles angled down-out */}
      <mesh position={[-0.46, -0.06, 0.3]} rotation={[0, Math.PI / 2, -0.55]} castShadow>
        <coneGeometry args={[0.16, 0.7, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
      </mesh>
      <mesh position={[0.46, -0.06, 0.3]} rotation={[0, -Math.PI / 2, 0.55]} castShadow>
        <coneGeometry args={[0.16, 0.7, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
      </mesh>
      {/* === DORSAL FIN === — pokes above water surface */}
      <group ref={finRef}>
        <mesh position={[0, 0.55, 0.05]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.18, 0.70, 4]} />
          <meshStandardMaterial color={COLORS.shark} roughness={0.7} />
        </mesh>
        {/* Subtle white highlight along dorsal fin's leading edge */}
        <mesh position={[0, 0.62, 0.13]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.05, 0.55, 4]} />
          <meshStandardMaterial color={'#5a6b75'} roughness={0.6} />
        </mesh>
      </group>
      {/* === V WAKE === unchanged from v1.2 */}
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
          opacity={0.4}
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
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
