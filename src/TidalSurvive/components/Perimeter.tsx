import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { PLAYFIELD, WATER_BASE_Y, WATER_Y_PER_LEVEL } from '../constants';
import type { GameRef } from '../hooks/useGameLoop';

interface Prop {
  kind: 'palm' | 'post' | 'wreck';
  x: number; z: number;
  scale: number;
  rotY: number;
}

// Deterministic perimeter dressing — palms, broken posts, ship wreck pieces.
// They sit just OUTSIDE the playable grid so they read as "we're somewhere
// specific, not on an abstract chessboard". As the tide rises they slowly
// submerge along with the world.
export function Perimeter({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const rootRef = useRef<THREE.Group>(null);

  const props = useMemo<Prop[]>(() => {
    const arr: Prop[] = [];
    const r = PLAYFIELD / 2 + 4;
    // 4 palm clusters anchored at the cardinal corners
    arr.push({ kind: 'palm',  x:  r * 0.85, z:  r * 0.85, scale: 1.2, rotY: 0.4 });
    arr.push({ kind: 'palm',  x: -r * 0.92, z: -r * 0.80, scale: 1.0, rotY: -0.6 });
    arr.push({ kind: 'palm',  x:  r * 0.70, z: -r * 0.95, scale: 1.1, rotY: 0.9 });
    arr.push({ kind: 'palm',  x: -r * 0.78, z:  r * 0.92, scale: 0.9, rotY: -0.3 });
    // 5 broken posts scattered around perimeter
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + 0.6;
      arr.push({
        kind: 'post',
        x: Math.cos(ang) * r * 1.05,
        z: Math.sin(ang) * r * 1.05,
        scale: 0.6 + Math.random() * 0.4,
        rotY: ang + Math.PI / 2,
      });
    }
    // 3 wreck pieces near the corners (visible from start)
    arr.push({ kind: 'wreck', x:  r * 1.15, z:  r * 0.20, scale: 1.0, rotY: 0.4 });
    arr.push({ kind: 'wreck', x: -r * 1.10, z: -r * 0.30, scale: 0.9, rotY: -0.5 });
    arr.push({ kind: 'wreck', x:  r * 0.10, z: -r * 1.20, scale: 1.1, rotY: 1.2 });
    return arr;
  }, []);

  // Sink the perimeter group along with the tide so high-water levels visually
  // remove the scenery (storm has swallowed the beach).
  useFrame(() => {
    if (!rootRef.current) return;
    const d = stateRef.current;
    const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    const submerge = Math.max(0, waterY) * 1.1;
    rootRef.current.position.y = -submerge;
  });

  return (
    <group ref={rootRef}>
      {props.map((p, i) => {
        if (p.kind === 'palm') {
          return (
            <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]} scale={p.scale}>
              {/* trunk */}
              <mesh position={[0, 1.5, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.28, 3.0, 8]} />
                <meshStandardMaterial color="#6a4a2a" roughness={0.9} />
              </mesh>
              {/* fronds — 5 angled boxes around the top */}
              {Array.from({ length: 5 }, (_, k) => {
                const a = (k / 5) * Math.PI * 2;
                return (
                  <mesh
                    key={k}
                    position={[Math.cos(a) * 0.45, 3.2, Math.sin(a) * 0.45]}
                    rotation={[0, a, 0.5]}
                    castShadow
                  >
                    <boxGeometry args={[1.4, 0.06, 0.36]} />
                    <meshStandardMaterial color="#3e5e36" roughness={0.85} />
                  </mesh>
                );
              })}
            </group>
          );
        }
        if (p.kind === 'post') {
          return (
            <group key={i} position={[p.x, 0, p.z]} rotation={[0.18, p.rotY, 0]}>
              <mesh position={[0, 0.6 * p.scale, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.15, 1.2 * p.scale, 6]} />
                <meshStandardMaterial color="#5a3a1f" roughness={0.95} />
              </mesh>
            </group>
          );
        }
        // Wreck — weathered debris half-submerged in the sea.
        // v1.10: visually distinguished from the warm-brown PLANK items.
        //   - cool weathered grey-blue (sea-soaked driftwood, not fresh wood)
        //   - heavy tilt to read as "wrecked", not "ready to use"
        //   - sunk a bit below ground so it sits in the water, not on land
        //   - moss/algae green accents + white barnacles
        return (
          <group key={i} position={[p.x, -0.35, p.z]} rotation={[0.4, p.rotY, 0.25]} scale={p.scale}>
            <RoundedBox args={[1.8, 0.22, 0.5]} radius={0.06} smoothness={3} position={[0, 0.18, 0]} castShadow>
              <meshStandardMaterial color="#5a6770" roughness={0.95} />
            </RoundedBox>
            <RoundedBox args={[1.0, 0.18, 0.42]} radius={0.06} smoothness={3} position={[0.5, 0.34, 0.18]} rotation={[0, 0.8, 0.4]} castShadow>
              <meshStandardMaterial color="#3e4a52" roughness={0.95} />
            </RoundedBox>
            <RoundedBox args={[0.7, 0.16, 0.40]} radius={0.06} smoothness={3} position={[-0.65, 0.22, -0.05]} rotation={[0, -0.9, -0.3]} castShadow>
              <meshStandardMaterial color="#7a878f" roughness={0.95} />
            </RoundedBox>
            {/* Moss / algae accent — small green patch */}
            <mesh position={[-0.1, 0.30, 0.18]}>
              <boxGeometry args={[0.4, 0.05, 0.18]} />
              <meshStandardMaterial color="#3a5e3a" roughness={0.95} />
            </mesh>
            {/* Barnacles — 3 tiny white-cream spheres */}
            <mesh position={[0.35, 0.30, -0.10]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color="#e8e0c8" roughness={0.6} />
            </mesh>
            <mesh position={[0.10, 0.32, 0.13]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshStandardMaterial color="#e8e0c8" roughness={0.6} />
            </mesh>
            <mesh position={[-0.45, 0.25, 0.05]}>
              <sphereGeometry args={[0.04, 8, 6]} />
              <meshStandardMaterial color="#e8e0c8" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
