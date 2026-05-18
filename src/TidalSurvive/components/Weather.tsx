import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYFIELD } from '../constants';
import type { GameRef } from '../hooks/useGameLoop';

const RAIN_COUNT = 280;
const RAIN_AREA = PLAYFIELD * 2.6;
const RAIN_HEIGHT = 16;

// Builds a Points cloud of rain streaks. Each particle has an initial
// position (x, y, z) and falls along -y. Wrapping is done on the GPU by
// keeping the position buffer + cycling y in useFrame.
export function Weather({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const speeds = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * RAIN_AREA;
      positions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
      speeds[i] = 18 + Math.random() * 12;
    }
    return { positions, speeds };
  }, []);

  // Light + fog driven by waterLevel (the scene gradually goes from dusk to
  // storm). Three's scene/light refs are pulled from `useThree` so we mutate
  // the singleton instead of re-rendering.
  const { scene } = useThree();
  useFrame((_, delta) => {
    const d = stateRef.current;
    if (!ref.current) return;
    // Storm intensity 0..1 — clamp by waterLevel
    const intensity = Math.min(1, d.waterLevelTarget / 8);
    const visible = intensity > 0.05;
    ref.current.visible = visible;

    if (visible) {
      const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const speedScale = 1 + intensity * 1.2; // heavier rain at higher levels
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 3 + 1] -= speeds[i] * speedScale * delta;
        if (arr[i * 3 + 1] < -1) {
          arr[i * 3 + 1] = RAIN_HEIGHT;
          arr[i * 3 + 0] = (Math.random() - 0.5) * RAIN_AREA;
          arr[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
        }
      }
      pos.needsUpdate = true;
    }

    // Scene fog color + density ramp with intensity
    if (scene.fog && (scene.fog as THREE.Fog).color) {
      const f = scene.fog as THREE.Fog;
      // Start: #0a2238 dusk, → #1a1820 storm gray
      const r = (1 - intensity) * 0x0a + intensity * 0x1a;
      const g = (1 - intensity) * 0x22 + intensity * 0x18;
      const b = (1 - intensity) * 0x38 + intensity * 0x20;
      f.color.setRGB(r / 255, g / 255, b / 255);
      f.near = PLAYFIELD * (1.2 - intensity * 0.4);
      f.far = PLAYFIELD * (3 - intensity * 0.8);
    }
  });

  return (
    <points ref={ref} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={RAIN_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#bcd6e8"
        size={0.08}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}
