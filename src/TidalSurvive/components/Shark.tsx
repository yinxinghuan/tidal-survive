import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// Shark — v1.9 rework focused on TOP-DOWN readability.
// Real top-down shark silhouette: long narrow body, pointed nose, two
// pectoral fins like wings sticking out, dorsal triangle in the middle
// (visible above water), TAIL = backward V/arrow lying flat at water level.
//
// The previous design had a vertical crescent tail. From above, two
// vertical lobes at the same XZ point read as a single dark line — they
// disappear. v1.9 lays the tail FLAT so it's clearly visible from above.
//
// Coordinate convention: body axis along +Z (forward). The whole shark
// rotates on Y via the parent group, so rotation.y = 0 → snout toward +Z.
export function Shark({ lungingRef }: { lungingRef?: React.MutableRefObject<boolean> }) {
  const wiggle = useRef<THREE.Group>(null);
  const finRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Group>(null);
  const wakeLeft = useRef<THREE.Mesh>(null);
  const wakeRight = useRef<THREE.Mesh>(null);
  const wakeLeftMat = useRef<THREE.MeshBasicMaterial>(null);
  const wakeRightMat = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const lunging = lungingRef?.current ?? false;
    const t = clock.getElapsedTime();
    if (wiggle.current) {
      const tt = t * (lunging ? 7 : 4) + phase.current;
      const amp = lunging ? 0.36 : 0.14;
      wiggle.current.rotation.y = Math.sin(tt) * amp;
    }
    if (tailRef.current) {
      // Tail sweeps side-to-side via local Y rotation — visible from above.
      tailRef.current.rotation.y = Math.sin(t * (lunging ? 9 : 5) + phase.current) * (lunging ? 0.55 : 0.30);
    }
    if (finRef.current) {
      const target = lunging ? 1.35 : 1.0;
      const s = finRef.current.scale.x;
      finRef.current.scale.setScalar(s + (target - s) * 0.12);
    }
    if (jawRef.current) {
      const open = lunging ? (0.05 + Math.abs(Math.sin(t * 12 + phase.current)) * 0.04) : 0;
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
      {/* === BODY === wider in the middle, narrows toward tail. The XZ
          footprint is what reads from above — width 0.85 mid, length 2.4. */}
      <mesh position={[0, 0.06, 0]} castShadow>
        {/* Use a stretched octahedron-like silhouette via a sphere scaled in
            XYZ. Sphere geometry gives the curve along all axes so the top-
            down silhouette is a smooth elongated oval. */}
        <sphereGeometry args={[0.5, 14, 10]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.55} />
      </mesh>
      {/* Stretch the body via parent group on the next mesh — actually easier:
          give body its own scale via a wrapping group. */}

      {/* TAPERED NOSE — flat-ish cone projecting forward along +Z */}
      <mesh position={[0, 0.04, 0.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.34, 0.95, 14]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.55} />
      </mesh>
      {/* Pale belly under the nose */}
      <mesh position={[0, -0.12, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 0.85, 12]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>

      {/* HEAD WIDENING — small rounded box right behind the nose to suggest
          the pectoral-shoulder region */}
      <mesh position={[0, 0.08, 0.4]} castShadow>
        <boxGeometry args={[0.7, 0.34, 0.6]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.55} />
      </mesh>

      {/* MIDDLE BODY — short stretched box */}
      <mesh position={[0, 0.05, -0.15]} castShadow>
        <boxGeometry args={[0.6, 0.32, 0.7]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.55} />
      </mesh>

      {/* REAR TAPER — narrower box leading to the tail */}
      <mesh position={[0, 0.0, -0.8]} castShadow>
        <boxGeometry args={[0.35, 0.22, 0.7]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.55} />
      </mesh>

      {/* === BELLY === pale boxes underneath the dark top so a sliver of
          white shows from the side. Top-down view doesn't see it but
          three-quarter views do. */}
      <mesh position={[0, -0.18, 0.3]}>
        <boxGeometry args={[0.66, 0.18, 0.65]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.13, -0.2]}>
        <boxGeometry args={[0.55, 0.15, 0.7]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>

      {/* === EYES === small dark spheres on each side of nose-base */}
      <mesh position={[-0.22, 0.16, 0.55]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={'#0b1116'} roughness={0.3} />
      </mesh>
      <mesh position={[0.22, 0.16, 0.55]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={'#0b1116'} roughness={0.3} />
      </mesh>
      <mesh position={[-0.205, 0.19, 0.59]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color={'#ffffff'} />
      </mesh>
      <mesh position={[0.235, 0.19, 0.59]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color={'#ffffff'} />
      </mesh>

      {/* === JAW === lower jaw under the nose, opens when lunging */}
      <group ref={jawRef} position={[0, -0.12, 0.75]}>
        <mesh>
          <boxGeometry args={[0.42, 0.05, 0.55]} />
          <meshStandardMaterial color={'#1a232a'} roughness={0.7} />
        </mesh>
        {/* Tooth strip — bright white line */}
        <mesh position={[0, 0.04, 0.22]}>
          <boxGeometry args={[0.40, 0.02, 0.05]} />
          <meshStandardMaterial color={'#ffffff'} roughness={0.4} />
        </mesh>
      </group>

      {/* === GILL SLITS === 3 lines on each side, dark */}
      {[-0.0, 0.10, 0.20].map((zOff, i) => (
        <mesh key={`gillL_${i}`} position={[-0.32, 0.04, zOff]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.025, 0.20, 0.025]} />
          <meshStandardMaterial color={'#1d2730'} roughness={0.6} />
        </mesh>
      ))}
      {[-0.0, 0.10, 0.20].map((zOff, i) => (
        <mesh key={`gillR_${i}`} position={[0.32, 0.04, zOff]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.025, 0.20, 0.025]} />
          <meshStandardMaterial color={'#1d2730'} roughness={0.6} />
        </mesh>
      ))}

      {/* === PECTORAL FINS === flat triangles sticking out horizontally to
          the sides. From top-down these are the unmistakable shark "wings".
          Made from a wide flat cone lying horizontal. */}
      {/* Left pectoral */}
      <mesh
        position={[-0.6, 0.0, 0.25]}
        rotation={[Math.PI / 2, 0, -Math.PI / 2 + 0.4]}
        castShadow
      >
        <coneGeometry args={[0.32, 0.85, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.6} />
      </mesh>
      <mesh
        position={[-0.6, -0.05, 0.25]}
        rotation={[Math.PI / 2, 0, -Math.PI / 2 + 0.4]}
      >
        <coneGeometry args={[0.27, 0.80, 3]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>
      {/* Right pectoral */}
      <mesh
        position={[0.6, 0.0, 0.25]}
        rotation={[Math.PI / 2, 0, Math.PI / 2 - 0.4]}
        castShadow
      >
        <coneGeometry args={[0.32, 0.85, 3]} />
        <meshStandardMaterial color={COLORS.shark} roughness={0.6} />
      </mesh>
      <mesh
        position={[0.6, -0.05, 0.25]}
        rotation={[Math.PI / 2, 0, Math.PI / 2 - 0.4]}
      >
        <coneGeometry args={[0.27, 0.80, 3]} />
        <meshStandardMaterial color={COLORS.sharkBelly} roughness={0.85} />
      </mesh>

      {/* === DORSAL FIN === pokes upward (above water) — visible from top
          as a small triangle silhouette. Scales 1.0→1.35 when lunging. */}
      <group ref={finRef}>
        <mesh position={[0, 0.55, 0.0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.20, 0.75, 4]} />
          <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.62, 0.08]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.06, 0.60, 4]} />
          <meshStandardMaterial color={'#5a6b75'} roughness={0.6} />
        </mesh>
      </group>

      {/* === TAIL === FLAT V-shape pointing backward. Made of two long
          horizontal cones meeting at the tail base, splaying outward in
          the -Z direction. Plus a smaller upper vertical lobe for 3D depth.
          The tail group rotates on Y for the wiggle, around the base point. */}
      <group ref={tailRef} position={[0, 0.05, -1.15]}>
        {/* Left tail blade — flat horizontal cone */}
        <mesh
          position={[-0.30, 0, -0.45]}
          rotation={[Math.PI / 2, 0, -0.5]}
          castShadow
        >
          <coneGeometry args={[0.30, 1.0, 3]} />
          <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
        </mesh>
        {/* Right tail blade */}
        <mesh
          position={[0.30, 0, -0.45]}
          rotation={[Math.PI / 2, 0, 0.5]}
          castShadow
        >
          <coneGeometry args={[0.30, 1.0, 3]} />
          <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
        </mesh>
        {/* Upper lobe — vertical, gives 3D anatomy + heterocercal feel */}
        <mesh
          position={[0, 0.35, -0.5]}
          rotation={[0, 0, 0]}
          castShadow
        >
          <coneGeometry args={[0.18, 0.70, 4]} />
          <meshStandardMaterial color={COLORS.shark} roughness={0.65} />
        </mesh>
      </group>

      {/* === V WAKE === unchanged */}
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
