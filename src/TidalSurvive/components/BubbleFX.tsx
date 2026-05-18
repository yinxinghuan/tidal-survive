import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Bubble } from '../types';
import type { GameRef } from '../hooks/useGameLoop';

// One foam bubble — a tiny white sphere that grows from 0 → maxRadius then
// fades. Lives for `life` seconds.
function FoamBubble({ bubble, stateRef }: {
  bubble: Bubble;
  stateRef: React.MutableRefObject<GameRef>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const age = stateRef.current.time - bubble.startTime;
    const p = Math.min(1, age / bubble.life);
    // grow quickly (0→1 over first 30%) then hold, fade opacity over last 60%
    const growth = Math.min(1, p / 0.3);
    const s = growth * bubble.maxRadius;
    meshRef.current.scale.set(s, s, s);
    // Slight upward drift as it rises (bubbles float to surface and dissipate)
    meshRef.current.position.y = bubble.worldY + p * 0.08;
    const fade = p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6;
    matRef.current.opacity = fade * 0.9;
  });
  return (
    <mesh
      ref={meshRef}
      position={[bubble.worldX + bubble.offsetX, bubble.worldY, bubble.worldZ + bubble.offsetZ]}
    >
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial ref={matRef} color="#ffffff" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function BubbleFX({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const [, force] = useState(0);
  const lastCount = useRef(-1);
  useFrame(() => {
    const len = stateRef.current.bubbles.length;
    if (len !== lastCount.current) {
      lastCount.current = len;
      force(x => x + 1);
    }
  });
  return (
    <>
      {stateRef.current.bubbles.map(b => (
        <FoamBubble key={b.id} bubble={b} stateRef={stateRef} />
      ))}
    </>
  );
}
