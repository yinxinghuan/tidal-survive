import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  TILE_SIZE, TILE_THICKNESS, GROUND_Y, COLORS,
  WATER_BASE_Y, WATER_Y_PER_LEVEL, DROWN_MARGIN, TILE_SINK_DEPTH,
} from '../constants';
import { TILE_GROW_ANIM, type GameRef } from '../hooks/useGameLoop';

// Pick a stack-layer color by its index from the ground (0 = first layer).
function layerColor(layerIndex: number): string {
  if (layerIndex === 0) return COLORS.layer1;
  if (layerIndex === 1) return COLORS.layer2;
  if (layerIndex === 2) return COLORS.layer3;
  return COLORS.layerHigh;
}

// Top-most stack layer animates a scale-in (1.4 → 1.0 over TILE_GROW_ANIM)
// whenever the height grows.
function GrowLayer({
  height, growAt, color, stateRef,
}: {
  height: number; growAt: number;
  color: string; stateRef: React.MutableRefObject<GameRef>;
}) {
  const ref = useRef<THREE.Group>(null);
  const lastGrow = useRef(growAt);
  useFrame(() => {
    if (!ref.current) return;
    const t = stateRef.current.time;
    const age = t - lastGrow.current;
    if (age < TILE_GROW_ANIM) {
      const p = age / TILE_GROW_ANIM;
      const s = 1.4 - 0.45 * Math.min(1, p * 1.4) + 0.05 * Math.sin(p * Math.PI * 3) * (1 - p);
      ref.current.scale.set(s, s, s);
    } else {
      ref.current.scale.set(1, 1, 1);
    }
  });
  if (growAt !== lastGrow.current) lastGrow.current = growAt;
  const y = GROUND_Y + (height - 1 + 0.5) * TILE_THICKNESS;
  return (
    <group ref={ref} position={[0, y, 0]}>
      <RoundedBox
        args={[TILE_SIZE * 0.92, TILE_THICKNESS, TILE_SIZE * 0.92]}
        radius={0.10} smoothness={3}
        position={[0, 0, 0]}
        castShadow receiveShadow
      >
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
    </group>
  );
}

// Each tile listens to the state ref for: water level (am I drowned?), the
// player's current tile (am I the one they're standing on?), and the grow
// timestamp. We use a single useFrame per tile so the renderer doesn't need
// to re-mount on these signal changes.
export function Tile({
  col, row, height, growAt, x, z, stateRef,
}: {
  col: number; row: number; height: number; growAt: number;
  x: number; z: number;
  stateRef: React.MutableRefObject<GameRef>;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tintRef = useRef<THREE.MeshStandardMaterial>(null);
  const drownPhase = useRef(0); // 0 = dry, 1 = fully sunk

  useFrame((_, delta) => {
    const d = stateRef.current;
    if (!rootRef.current) return;

    // Sink amount: once the tile drowns it eases down by TILE_SINK_DEPTH.
    const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    const myTop = GROUND_Y + Math.max(0, height) * TILE_THICKNESS;
    const drowned = waterY > myTop - DROWN_MARGIN;
    const target = drowned ? 1 : 0;
    drownPhase.current += (target - drownPhase.current) * Math.min(1, delta * 4);
    rootRef.current.position.y = -drownPhase.current * TILE_SINK_DEPTH;

    // Player halo — only visible on the tile under the player's feet.
    if (haloMatRef.current && haloRef.current) {
      const isPlayer = d.playerCol === col && d.playerRow === row && !drowned;
      haloMatRef.current.opacity += ((isPlayer ? 0.85 : 0) - haloMatRef.current.opacity) * 0.18;
      // Hover y a touch above the current tile top
      haloRef.current.position.y = myTop + 0.02;
    }

    // Top-layer wet tint — once 50% drowned, dim the top layer toward sandWet.
    if (tintRef.current) {
      const wet = drownPhase.current;
      const r = (1 - wet) * 0xe6 + wet * 0x7a;
      const g = (1 - wet) * 0xcf + wet * 0x8a;
      const b = (1 - wet) * 0x9c + wet * 0xa0;
      tintRef.current.color.setRGB(r / 255, g / 255, b / 255);
    }
  });

  // Stack layers (everything except the top)
  const staticLayers: { y: number; color: string }[] = [];
  for (let i = 0; i < height - 1; i++) {
    const y = GROUND_Y + (i + 0.5) * TILE_THICKNESS;
    staticLayers.push({ y, color: layerColor(i) });
  }
  const topColor = height > 0 ? layerColor(height - 1) : COLORS.sand;

  return (
    <group ref={rootRef} position={[x, 0, z]}>
      {/* Base sand layer — wet-tint on drown via tintRef */}
      <RoundedBox
        args={[TILE_SIZE * 0.96, TILE_THICKNESS, TILE_SIZE * 0.96]}
        radius={0.08} smoothness={3}
        position={[0, GROUND_Y - TILE_THICKNESS / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial ref={tintRef} color={COLORS.sand} roughness={0.9} />
      </RoundedBox>
      {staticLayers.map((l, i) => (
        <RoundedBox
          key={`s-${col}-${row}-${i}`}
          args={[TILE_SIZE * 0.92, TILE_THICKNESS, TILE_SIZE * 0.92]}
          radius={0.10} smoothness={3}
          position={[0, l.y, 0]}
          castShadow receiveShadow
        >
          <meshStandardMaterial color={l.color} roughness={0.85} />
        </RoundedBox>
      ))}
      {height > 0 && (
        <GrowLayer
          height={height}
          growAt={growAt}
          color={topColor}
          stateRef={stateRef}
        />
      )}
      {/* Player tile halo — gold ring drawn slightly above the current top */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.02, 0]}>
        <ringGeometry args={[TILE_SIZE * 0.38, TILE_SIZE * 0.46, 32]} />
        <meshBasicMaterial ref={haloMatRef} color={COLORS.playerHalo} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
