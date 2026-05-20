import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_FOV, CAMERA_POS_BASE, PLAYFIELD, GRID, COLORS, WATER_BASE_Y, WATER_Y_PER_LEVEL } from '../constants';
import { Sailor } from './Sailor';
import { Shark } from './Shark';
import { ItemMesh } from './ItemMesh';
import { Tile } from './Tile';
import { Water } from './Water';
import { Birds } from './Birds';
import { FoamEdge } from './FoamEdge';
import { Weather } from './Weather';
import { Perimeter } from './Perimeter';
import { BubbleFX } from './BubbleFX';
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

// FollowCamera reads state.current.shakeX/Y/Z + tideDipPhase each frame.
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
    const zoomBoost = Math.min(d.maxHeightReached * 0.3, 3);
    // Tide dip: 0.9s arc, dips down then rebounds
    let dipY = 0;
    if (d.tideDipPhase > 0) {
      const p = d.tideDipPhase / 0.9; // 0..1
      // dip down for first half, overshoot up for second, settle
      dipY = -Math.sin(p * Math.PI) * d.tideDipMag;
    }
    offset.current.set(CAMERA_POS_BASE[0], CAMERA_POS_BASE[1] + zoomBoost + dipY, CAMERA_POS_BASE[2] + zoomBoost * 0.4);
    target.current.copy(head).add(offset.current);
    camera.position.lerp(target.current, 0.08);
    // Apply additive shake on top of the lerped position
    const sx = (Math.random() - 0.5) * d.shakeX;
    const sy = (Math.random() - 0.5) * d.shakeY;
    const sz = (Math.random() - 0.5) * d.shakeZ;
    camera.position.x += sx;
    camera.position.y += sy;
    camera.position.z += sz;
    camera.lookAt(head.x, 0, head.z);
  });
  return null;
}

// Animated ring drawn in-world for dust / splash / tide events.
function Ring({ ring, stateRef }: {
  ring: { id: number; kind: 'dust' | 'splash' | 'tide'; worldX: number; worldY: number; worldZ: number; startTime: number };
  stateRef: React.MutableRefObject<GameRef>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!groupRef.current || !matRef.current) return;
    const d = stateRef.current;
    const age = d.time - ring.startTime;
    const life = ring.kind === 'tide' ? 1.1 : ring.kind === 'splash' ? 0.7 : 0.55;
    const p = Math.min(1, age / life);
    const maxScale = ring.kind === 'tide' ? 32 : ring.kind === 'splash' ? 4 : 2.6;
    const s = 0.4 + p * maxScale;
    groupRef.current.scale.setScalar(s);
    matRef.current.opacity = (1 - p) * (ring.kind === 'tide' ? 0.55 : ring.kind === 'splash' ? 0.7 : 0.85);
  });
  const color = ring.kind === 'dust' ? '#d6c69b' : ring.kind === 'splash' ? '#cfe6f3' : '#ffffff';
  return (
    <group
      ref={groupRef}
      position={[ring.worldX, ring.worldY + 0.04, ring.worldZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh>
        <ringGeometry args={[0.42, 0.52, 32]} />
        <meshBasicMaterial ref={matRef} color={color} transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function RingFX({ state }: { state: React.MutableRefObject<GameRef> }) {
  const [, force] = useState(0);
  const lastCount = useRef(-1);
  useFrame(() => {
    const len = state.current.dustRings.length;
    if (len !== lastCount.current) {
      lastCount.current = len;
      force(x => x + 1);
    }
  });
  return (
    <>
      {state.current.dustRings.map(r => (
        <Ring key={r.id} ring={r} stateRef={state} />
      ))}
    </>
  );
}

// Airborne dust puff sprite. Position is derived each frame from the puff's
// initial velocity + gravity, so the game loop never touches it. The sprite
// faces the camera, grows in fast, then fades out as it settles back down.
const PUFF_G = -3.2;   // m/s² downward — lighter than real for a floaty feel

function Puff({ puff, stateRef }: {
  puff: {
    id: number; worldX: number; worldY: number; worldZ: number;
    vx: number; vy: number; vz: number; startTime: number;
    size: number; life: number; color: string;
  };
  stateRef: React.MutableRefObject<GameRef>;
}) {
  const ref = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  useFrame(() => {
    const sp = ref.current; if (!sp || !matRef.current) return;
    const t = stateRef.current.time - puff.startTime;
    if (t < 0) return;
    // x/z: linear-decay outward drift over the puff's life
    const decay = Math.max(0, 1 - t / (puff.life * 1.2));
    const px = puff.worldX + puff.vx * t * (0.4 + 0.6 * decay);
    const pz = puff.worldZ + puff.vz * t * (0.4 + 0.6 * decay);
    // y: ballistic, clamped to ground so it settles
    const py = Math.max(puff.worldY, puff.worldY + puff.vy * t + 0.5 * PUFF_G * t * t);
    sp.position.set(px, py, pz);
    const u = Math.min(1, t / puff.life);
    const grow = u < 0.25 ? u / 0.25 : 1;
    const scale = puff.size * (0.7 + grow * 1.4);
    sp.scale.set(scale, scale, scale);
    matRef.current.opacity = (1 - Math.pow(u, 1.4)) * 0.85;
  });
  return (
    <sprite ref={ref} position={[puff.worldX, puff.worldY, puff.worldZ]}>
      <spriteMaterial
        ref={matRef}
        map={DUST_TEXTURE}
        color={puff.color}
        transparent
        depthWrite={false}
        opacity={0}
      />
    </sprite>
  );
}

// Soft radial puff texture, generated once on a canvas. White centre fading
// to transparent — tinted per-puff via spriteMaterial.color.
const DUST_TEXTURE: THREE.CanvasTexture = (() => {
  const SIZE = 128;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
})();

function PuffFX({ state }: { state: React.MutableRefObject<GameRef> }) {
  const [, force] = useState(0);
  const lastCount = useRef(-1);
  useFrame(() => {
    const len = state.current.dustPuffs.length;
    if (len !== lastCount.current) {
      lastCount.current = len;
      force(x => x + 1);
    }
  });
  return (
    <>
      {state.current.dustPuffs.map(p => (
        <Puff key={p.id} puff={p} stateRef={state} />
      ))}
    </>
  );
}

// Cone marker hovering over the tutorial drop-target tile
function DropTargetMarker({ state }: { state: React.MutableRefObject<GameRef> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const d = state.current;
    if (!ref.current) return;
    if (!d.tutorialDropTarget) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const { col, row } = d.tutorialDropTarget;
    const c = tileCenter(col, row);
    const t = clock.getElapsedTime();
    ref.current.position.set(c.x, 1.5 + Math.sin(t * 4) * 0.18, c.z);
    ref.current.rotation.y = t * 1.5;
  });
  return (
    <group ref={ref} visible={false}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, 0, 0]}>
        <coneGeometry args={[0.45, 0.9, 4]} />
        <meshStandardMaterial color="#ffe17a" emissive="#ff9844" emissiveIntensity={0.9} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function ActorSync({ state, carryingRef }: {
  state: React.MutableRefObject<GameRef>;
  carryingRef: React.MutableRefObject<ItemKind | null>;
}) {
  const playerRef = useRef<THREE.Group>(null);
  const sharkRefs = useRef<Map<number, THREE.Group>>(new Map());
  const lungingRefs = useRef<Map<number, React.MutableRefObject<boolean>>>(new Map());
  const itemRefs = useRef<Map<number, THREE.Group>>(new Map());

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
    carryingRef.current = d.carrying;

    if (d.items.length !== lastSizes.current.items) {
      lastSizes.current.items = d.items.length;
      force(x => x + 1);
    }
  });

  const d = state.current;
  return (
    <>
      <group ref={playerRef}>
        <Sailor carryingRef={carryingRef} stateRef={state} />
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
          <ItemMesh kind={it.kind} highlight={d.tutorialItemId === it.id} />
        </group>
      ))}
    </>
  );
}

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
        <Tile
          key={`t_${c}_${r}`}
          col={c} row={r}
          height={d.heights[c][r]}
          growAt={d.lastGrowAt[c][r]}
          stateRef={state}
          x={center.x} z={center.z}
        />
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <planeGeometry args={[PLAYFIELD * 10, PLAYFIELD * 10]} />
        <meshStandardMaterial color={COLORS.waterDeep} roughness={0.9} />
      </mesh>

      <GridTerrain state={state} />
      <Water stateRef={state} />
      <FoamEdge stateRef={state} />
      <Perimeter stateRef={state} />
      <Weather stateRef={state} />
      <Birds stateRef={state} />
      <ActorSync state={state} carryingRef={carryingRef} />
      <RingFX state={state} />
      <PuffFX state={state} />
      <BubbleFX stateRef={state} />
      <DropTargetMarker state={state} />
    </>
  );
}

// Re-export so TidalSurvive.tsx can use them for the screen-space HUD overlays
export { WATER_BASE_Y, WATER_Y_PER_LEVEL };
