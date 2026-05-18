import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_FOV, CAMERA_POS_BASE, PLAYFIELD, GRID, COLORS } from '../constants';
import { Sailor } from './Sailor';
import { Shark } from './Shark';
import { ItemMesh } from './ItemMesh';
import { Tile } from './Tile';
import { Water } from './Water';
import { Birds } from './Birds';
import { useGameLoop, GameRef, tileCenter } from '../hooks/useGameLoop';
import type { ItemKind, Stick } from '../types';

interface SceneProps {
  state: React.MutableRefObject<GameRef>;
  playing: boolean;
  stickRef: React.MutableRefObject<Stick>;
  onScore: (s: number) => void;
  onGameOver: (final: number, reason: 'drowned' | 'shark') => void;
  onWaterFlash?: (kind: 'shark' | 'drown') => void;
  onTideEvent?: () => void;
  playSfx: (k: any) => void;
  haptic?: (k: 'light' | 'heavy') => void;
}

// Camera that follows the player. Like Penguin Rescue but pulls back slightly
// as the player gains height so the whole island stays visible.
function FollowCamera({ state }: { state: React.MutableRefObject<GameRef> }) {
  const { camera, size } = useThree();
  const offset = useRef(new THREE.Vector3(...CAMERA_POS_BASE));
  const target = useRef(new THREE.Vector3());

  useEffect(() => {
    const head = state.current.playerPos;
    camera.position.set(head.x + CAMERA_POS_BASE[0], head.y + CAMERA_POS_BASE[1], head.z + CAMERA_POS_BASE[2]);
    (camera as THREE.PerspectiveCamera).fov = CAMERA_FOV;
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 220;
    camera.lookAt(head.x, 0, head.z);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size.width, size.height, state]);

  useFrame(() => {
    const d = state.current;
    const head = d.playerPos;
    // Zoom out a bit if player is high
    const zoomBoost = Math.min(d.maxHeightReached * 0.3, 3);
    offset.current.set(CAMERA_POS_BASE[0], CAMERA_POS_BASE[1] + zoomBoost, CAMERA_POS_BASE[2] + zoomBoost * 0.4);
    target.current.copy(head).add(offset.current);
    camera.position.lerp(target.current, 0.08);
    camera.lookAt(head.x, 0, head.z);
  });
  return null;
}

// Syncs the player + shark transforms from state-refs every frame.
function ActorSync({ state, carryingRef }: {
  state: React.MutableRefObject<GameRef>;
  carryingRef: React.MutableRefObject<ItemKind | null>;
}) {
  const playerRef = useRef<THREE.Group>(null);
  const sharkRefs = useRef<Map<number, THREE.Group>>(new Map());
  const lungingRefs = useRef<Map<number, React.MutableRefObject<boolean>>>(new Map());
  const itemRefs = useRef<Map<number, THREE.Group>>(new Map());

  // Re-render when item counts change
  const [, force] = useState(0);
  const lastSizes = useRef({ items: -1 });

  useFrame(() => {
    const d = state.current;
    if (playerRef.current) {
      playerRef.current.position.copy(d.playerPos);
      playerRef.current.rotation.y = d.playerRot;
    }
    for (const s of d.sharks) {
      const g = sharkRefs.current.get(s.id);
      if (g) {
        g.position.copy(s.position);
        g.rotation.y = s.rotation;
      }
      const lr = lungingRefs.current.get(s.id);
      if (lr) lr.current = s.lunging;
    }
    for (const it of d.items) {
      const g = itemRefs.current.get(it.id);
      if (g) g.position.copy(it.position);
    }
    // Mirror carry state for the Sailor's held-item visual
    carryingRef.current = d.carrying;

    // Force re-render on item count delta so newly spawned items appear
    if (d.items.length !== lastSizes.current.items) {
      lastSizes.current.items = d.items.length;
      force(x => x + 1);
    }
  });

  const d = state.current;
  return (
    <>
      <group ref={playerRef}>
        <Sailor carryingRef={carryingRef} />
      </group>
      {d.sharks.map(s => {
        if (!lungingRefs.current.get(s.id)) {
          lungingRefs.current.set(s.id, { current: s.lunging });
        }
        return (
          <group key={`sh_${s.id}`} ref={el => {
            if (el) sharkRefs.current.set(s.id, el);
            else sharkRefs.current.delete(s.id);
          }}>
            <Shark lungingRef={lungingRefs.current.get(s.id)} />
          </group>
        );
      })}
      {d.items.map(it => (
        <group key={`it_${it.id}`} ref={el => {
          if (el) itemRefs.current.set(it.id, el);
          else itemRefs.current.delete(it.id);
        }}>
          <ItemMesh kind={it.kind} />
        </group>
      ))}
    </>
  );
}

// Renders the 8x8 height grid. Re-renders only when any height changes.
function GridTerrain({ state }: { state: React.MutableRefObject<GameRef> }) {
  const [, force] = useState(0);
  const lastSum = useRef(-1);
  useFrame(() => {
    const d = state.current;
    let sum = 0;
    for (let c = 0; c < GRID; c++) {
      for (let r = 0; r < GRID; r++) sum += d.heights[c][r];
    }
    if (sum !== lastSum.current) {
      lastSum.current = sum;
      force(x => x + 1);
    }
  });
  const d = state.current;
  const tiles: JSX.Element[] = [];
  for (let c = 0; c < GRID; c++) {
    for (let r = 0; r < GRID; r++) {
      const center = tileCenter(c, r);
      tiles.push(
        <Tile key={`t_${c}_${r}`} col={c} row={r} height={d.heights[c][r]} x={center.x} z={center.z} />
      );
    }
  }
  return <>{tiles}</>;
}

export function Scene({
  state, playing, stickRef, onScore, onGameOver, onWaterFlash, onTideEvent, playSfx, haptic,
}: SceneProps) {
  const carryingRef = useRef<ItemKind | null>(null);
  useGameLoop({
    state, playing, stick: stickRef.current,
    onScore, onGameOver, onWaterFlash, onTideEvent, playSfx, haptic,
  });

  return (
    <>
      <FollowCamera state={state} />
      <fog attach="fog" args={['#0a2238', PLAYFIELD * 1.2, PLAYFIELD * 3]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[16, 30, 8]}
        intensity={1.45}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-bias={-0.0008}
      />
      <hemisphereLight args={['#a9c8df', '#3b556e', 0.4]} />

      {/* Distant deep-ocean ring beyond the camera fog. Sits well below the
          water plane so the rising water always reads as the visible
          surface. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <planeGeometry args={[PLAYFIELD * 10, PLAYFIELD * 10]} />
        <meshStandardMaterial color={COLORS.waterDeep} roughness={0.9} />
      </mesh>

      <GridTerrain state={state} />
      <Water stateRef={state} />
      <Birds stateRef={state} />
      <ActorSync state={state} carryingRef={carryingRef} />
    </>
  );
}
