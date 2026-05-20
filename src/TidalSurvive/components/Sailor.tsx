import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, WATER_BASE_Y, WATER_Y_PER_LEVEL } from '../constants';
import type { ItemKind } from '../types';
import type { GameRef } from '../hooks/useGameLoop';

interface SailorProps {
  carryingRef?: React.MutableRefObject<ItemKind | null>;
  stateRef?: React.MutableRefObject<GameRef>;
}

export function Sailor({ carryingRef, stateRef }: SailorProps) {
  const bounceRef = useRef<THREE.Group>(null);
  const leanRef = useRef<THREE.Group>(null);
  const heldRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const kind = carryingRef?.current ?? null;
    // Drive the hop off the game-loop clock (no per-instance random phase) so
    // the dust spawner in useGameLoop can land each puff on the exact moment
    // the foot hits the ground.
    const gt = stateRef?.current.time ?? 0;
    if (bounceRef.current) {
      const t = gt * (kind === 'boulder' ? 4 : 6);
      const amp = kind === 'boulder' ? 0.18 : 0.45;
      bounceRef.current.position.y = Math.abs(Math.sin(t)) * amp;
      bounceRef.current.rotation.z = Math.sin(t) * 0.08;
      bounceRef.current.rotation.x = 0.08;
    }
    // Forward lean only when carrying boulder
    if (leanRef.current) {
      const targetLean = kind === 'boulder' ? 0.22 : 0;
      leanRef.current.rotation.x += (targetLean - leanRef.current.rotation.x) * 0.12;
    }
    // Show held item only if currently carrying
    if (heldRef.current) {
      heldRef.current.visible = !!kind;
    }
    // Subtle "in water" tilt — sink the body a bit when wading
    if (stateRef && bounceRef.current) {
      const d = stateRef.current;
      const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
      const inWater = d.playerPos.y < waterY + 0.05;
      if (inWater) {
        bounceRef.current.rotation.z += Math.sin(d.time * 8) * 0.03;
      }
    }
  });

  const kind = carryingRef?.current ?? null;

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.32} />
      </mesh>
      <group ref={bounceRef}>
        {/* Lean group — boulder bends sailor forward */}
        <group ref={leanRef}>
          <RoundedBox args={[0.7, 0.55, 0.55]} radius={0.16} smoothness={4} position={[0, 0.32, 0]} castShadow>
            <meshStandardMaterial color={COLORS.sailorPants} roughness={0.85} />
          </RoundedBox>
          <RoundedBox args={[0.86, 0.65, 0.65]} radius={0.22} smoothness={4} position={[0, 0.85, 0]} castShadow>
            <meshStandardMaterial color={COLORS.sailorJacket} roughness={0.7} />
          </RoundedBox>
          <RoundedBox args={[0.92, 0.18, 0.66]} radius={0.07} smoothness={3} position={[0, 0.62, 0]}>
            <meshStandardMaterial color={COLORS.sailorJacketDark} roughness={0.7} />
          </RoundedBox>
          <mesh position={[0, 0.84, 0.34]}>
            <boxGeometry args={[0.16, 0.16, 0.04]} />
            <meshStandardMaterial color="#fff8c4" emissive="#ffdc6f" emissiveIntensity={0.3} />
          </mesh>
          <group position={[0, 1.42, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.34, 18, 14]} />
              <meshStandardMaterial color={COLORS.sailorSkin} roughness={0.65} />
            </mesh>
            <RoundedBox args={[0.66, 0.16, 0.66]} radius={0.07} smoothness={3} position={[0, 0.22, 0]} castShadow>
              <meshStandardMaterial color="#f6f7fa" roughness={0.6} />
            </RoundedBox>
            <RoundedBox args={[0.7, 0.06, 0.7]} radius={0.03} smoothness={3} position={[0, 0.13, 0]}>
              <meshStandardMaterial color="#1b2a40" roughness={0.6} />
            </RoundedBox>
            <mesh position={[-0.11, 0.03, 0.30]}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color="#0b1422" />
            </mesh>
            <mesh position={[0.11, 0.03, 0.30]}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color="#0b1422" />
            </mesh>
            <mesh position={[0, -0.07, 0.32]}>
              <boxGeometry args={[0.10, 0.025, 0.02]} />
              <meshStandardMaterial color="#3a2818" />
            </mesh>
          </group>
        </group>
        {/* Held item — anchored above head. Plank held wide overhead;
            boulder held lower at chest height so it visually reads as heavy. */}
        <group ref={heldRef} visible={!!kind}>
          {kind === 'plank' && (
            <group position={[0, 2.05, 0]}>
              <RoundedBox args={[1.8, 0.18, 0.42]} radius={0.05} smoothness={3} castShadow>
                <meshStandardMaterial color={COLORS.plank} roughness={0.85} />
              </RoundedBox>
            </group>
          )}
          {kind === 'boulder' && (
            <group position={[0, 1.7, 0.25]} rotation={[0.2, 0, 0]}>
              <mesh castShadow>
                <dodecahedronGeometry args={[0.5, 0]} />
                <meshStandardMaterial color={COLORS.boulder} roughness={0.95} flatShading />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </>
  );
}
