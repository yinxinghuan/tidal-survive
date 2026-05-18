import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../constants';
import type { ItemKind } from '../types';

interface SailorProps {
  /** Optional held item; rendered above the head when set. */
  carryingRef?: React.MutableRefObject<ItemKind | null>;
}

// Stylized chunky sailor with orange life jacket. Same scale + bounce idiom
// as Penguin from the engine. Lives inside an outer <group> that the
// ActorSync useFrame transforms each frame.
export function Sailor({ carryingRef }: SailorProps) {
  const bounceRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const headRef = useRef<THREE.Group>(null);
  const heldRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (bounceRef.current) {
      const t = clock.getElapsedTime() * 6 + phase.current;
      bounceRef.current.position.y = Math.abs(Math.sin(t)) * 0.45;
      bounceRef.current.rotation.z = Math.sin(t) * 0.08;
      bounceRef.current.rotation.x = 0.08;
    }
    // Show held item only if currently carrying
    if (heldRef.current && carryingRef) {
      const k = carryingRef.current;
      heldRef.current.visible = !!k;
    }
  });

  const kind = carryingRef?.current ?? null;

  return (
    <>
      {/* contact shadow stays OUTSIDE bounce so it doesn't lift with the hop */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.32} />
      </mesh>
      <group ref={bounceRef}>
        {/* Pants (lower body) */}
        <RoundedBox args={[0.7, 0.55, 0.55]} radius={0.16} smoothness={4} position={[0, 0.32, 0]} castShadow>
          <meshStandardMaterial color={COLORS.sailorPants} roughness={0.85} />
        </RoundedBox>
        {/* Torso — orange life jacket */}
        <RoundedBox args={[0.86, 0.65, 0.65]} radius={0.22} smoothness={4} position={[0, 0.85, 0]} castShadow>
          <meshStandardMaterial color={COLORS.sailorJacket} roughness={0.7} />
        </RoundedBox>
        {/* Jacket darker side stripe */}
        <RoundedBox args={[0.92, 0.18, 0.66]} radius={0.07} smoothness={3} position={[0, 0.62, 0]}>
          <meshStandardMaterial color={COLORS.sailorJacketDark} roughness={0.7} />
        </RoundedBox>
        {/* Jacket front buckle */}
        <mesh position={[0, 0.84, 0.34]}>
          <boxGeometry args={[0.16, 0.16, 0.04]} />
          <meshStandardMaterial color="#fff8c4" emissive="#ffdc6f" emissiveIntensity={0.3} />
        </mesh>
        {/* Head + cap */}
        <group ref={headRef} position={[0, 1.42, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.34, 18, 14]} />
            <meshStandardMaterial color={COLORS.sailorSkin} roughness={0.65} />
          </mesh>
          {/* Sailor cap */}
          <RoundedBox args={[0.66, 0.16, 0.66]} radius={0.07} smoothness={3} position={[0, 0.22, 0]} castShadow>
            <meshStandardMaterial color="#f6f7fa" roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[0.7, 0.06, 0.7]} radius={0.03} smoothness={3} position={[0, 0.13, 0]}>
            <meshStandardMaterial color="#1b2a40" roughness={0.6} />
          </RoundedBox>
          {/* Eyes */}
          <mesh position={[-0.11, 0.03, 0.30]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#0b1422" />
          </mesh>
          <mesh position={[0.11, 0.03, 0.30]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#0b1422" />
          </mesh>
          {/* Tiny smile dot - a downturn for "this is dire" */}
          <mesh position={[0, -0.07, 0.32]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.10, 0.025, 0.02]} />
            <meshStandardMaterial color="#3a2818" />
          </mesh>
        </group>
        {/* Held item (anchored above head; visibility toggled in useFrame) */}
        <group ref={heldRef} position={[0, 2.0, 0]} visible={!!kind}>
          {kind === 'plank' && (
            <RoundedBox args={[1.6, 0.18, 0.42]} radius={0.05} smoothness={3} castShadow>
              <meshStandardMaterial color={COLORS.plank} roughness={0.85} />
            </RoundedBox>
          )}
          {kind === 'boulder' && (
            <mesh castShadow>
              <dodecahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial color={COLORS.boulder} roughness={0.95} flatShading />
            </mesh>
          )}
        </group>
      </group>
    </>
  );
}
