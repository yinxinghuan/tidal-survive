import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GRID, TILE_SIZE, TILE_THICKNESS,
  TIDE_INTERVAL, WATER_BASE_Y, WATER_Y_PER_LEVEL, DROWN_MARGIN, GROUND_Y,
  PLAYER_SPEED_NORMAL, PLAYER_SPEED_CARRYING_HEAVY, PLAYER_SPEED_CARRYING_LIGHT,
  SHARK_DELAY_IN_WATER, GRACE_PERIOD,
  ITEM_SPAWN_INTERVAL_MIN, ITEM_SPAWN_INTERVAL_MAX, ITEM_MAX_ACTIVE,
  ITEM_WEIGHTS, ITEM_PICKUP_RADIUS, PADDLE_TIDE_BUFFER, ITEM_DROP_HEIGHT,
  SHARK_COUNT, SHARK_PATROL_SPEED, SHARK_LUNGE_SPEED, SHARK_KILL_RADIUS, SHARK_ORBIT_R,
  BIRD_COUNT, HEIGHT_BONUS,
} from '../constants';
import type { Item, ItemKind, Shark, Bird, Stick } from '../types';

// World ↔ grid helpers. The grid is centered on origin.
// Tile (col, row): col=0..GRID-1 left→right (x), row=0..GRID-1 back→front (z).
const ORIGIN_OFFSET = (GRID - 1) / 2; // = 3.5 for GRID=8
export function tileCenter(col: number, row: number): { x: number; z: number } {
  return {
    x: (col - ORIGIN_OFFSET) * TILE_SIZE,
    z: (row - ORIGIN_OFFSET) * TILE_SIZE,
  };
}
export function worldToTile(x: number, z: number): { col: number; row: number } | null {
  const col = Math.round(x / TILE_SIZE + ORIGIN_OFFSET);
  const row = Math.round(z / TILE_SIZE + ORIGIN_OFFSET);
  if (col < 0 || col >= GRID || row < 0 || row >= GRID) return null;
  return { col, row };
}

export function tileTopY(stack: number): number {
  return GROUND_Y + Math.max(0, stack) * TILE_THICKNESS;
}

export interface GameRef {
  // Grid state — heights[col][row] = how many blocks stacked. 0 = bare sand at base.
  heights: number[][];
  // Player
  playerPos: THREE.Vector3;     // world XYZ; y = top of tile player is on (or water if drowning)
  playerRot: number;
  playerCol: number;
  playerRow: number;
  // Player carry
  carrying: ItemKind | null;
  carryPhase: number;           // for visual bob while held

  // Water level (continuous, lerps toward target on tide events)
  waterLevel: number;           // current displayed level
  waterLevelTarget: number;     // step target after a tide event
  nextTideAt: number;           // game time when level will increment next
  inWaterTime: number;          // seconds player has been in water (resets when dry)

  // Items
  items: Item[];
  nextItemSpawnAt: number;
  itemIdCounter: number;

  // Sharks
  sharks: Shark[];

  // Birds (ambient gulls)
  birds: Bird[];

  // Timers + state
  time: number;
  score: number;
  maxHeightReached: number;
  gameOver: boolean;
  gameOverReason: 'drowned' | 'shark' | null;
  lastGullAt: number;
  initialized: boolean;
}

export function createGameState(): GameRef {
  const heights: number[][] = [];
  for (let c = 0; c < GRID; c++) {
    heights.push(new Array(GRID).fill(0));
  }
  return {
    heights,
    playerPos: new THREE.Vector3(0, GROUND_Y, 0),
    playerRot: 0,
    playerCol: Math.floor(GRID / 2),
    playerRow: Math.floor(GRID / 2),
    carrying: null,
    carryPhase: 0,
    waterLevel: 0,
    waterLevelTarget: 0,
    nextTideAt: TIDE_INTERVAL,
    inWaterTime: 0,
    items: [],
    nextItemSpawnAt: 1.5,
    itemIdCounter: 1,
    sharks: [],
    birds: [],
    time: 0,
    score: 0,
    maxHeightReached: 0,
    gameOver: false,
    gameOverReason: null,
    lastGullAt: 0,
    initialized: false,
  };
}

function pickItemKind(): ItemKind {
  const total = ITEM_WEIGHTS.plank + ITEM_WEIGHTS.boulder + ITEM_WEIGHTS.paddle;
  let r = Math.random() * total;
  if ((r -= ITEM_WEIGHTS.plank) < 0) return 'plank';
  if ((r -= ITEM_WEIGHTS.boulder) < 0) return 'boulder';
  return 'paddle';
}

function carrySpeed(kind: ItemKind | null): number {
  if (kind === null) return PLAYER_SPEED_NORMAL;
  if (kind === 'boulder') return PLAYER_SPEED_CARRYING_HEAVY;
  return PLAYER_SPEED_CARRYING_LIGHT;
}

function heightGain(kind: ItemKind): number {
  if (kind === 'boulder') return 2;
  if (kind === 'plank') return 1;
  return 0; // paddle: no height
}

export interface GameLoopParams {
  state: React.MutableRefObject<GameRef>;
  playing: boolean;
  stick: Stick;
  onScore: (s: number) => void;
  onGameOver: (finalScore: number, reason: 'drowned' | 'shark') => void;
  onWaterFlash?: (kind: 'shark' | 'drown') => void;
  onTideEvent?: () => void;
  playSfx: (key:
    | 'splash' | 'thunk' | 'thud' | 'plank_drop' | 'boulder_lift'
    | 'paddle' | 'tide_rise' | 'shark_roar' | 'gull_cry' | 'game_over') => void;
  haptic?: (kind: 'light' | 'heavy') => void;
}

export function useGameLoop({
  state, playing, stick, onScore, onGameOver, onWaterFlash, onTideEvent, playSfx, haptic,
}: GameLoopParams) {
  // Initialize sharks + birds once per fresh state.
  if (!state.current.initialized) {
    const d = state.current;
    const sharks: Shark[] = [];
    for (let i = 0; i < SHARK_COUNT; i++) {
      const a = (i / SHARK_COUNT) * Math.PI * 2;
      sharks.push({
        id: i,
        position: new THREE.Vector3(Math.cos(a) * SHARK_ORBIT_R, WATER_BASE_Y - 0.3, Math.sin(a) * SHARK_ORBIT_R),
        rotation: 0,
        orbit: { cx: 0, cz: 0, r: SHARK_ORBIT_R, phase: a },
        lunging: false,
      });
    }
    d.sharks = sharks;

    const birds: Bird[] = [];
    for (let i = 0; i < BIRD_COUNT; i++) {
      birds.push({
        id: i,
        angle: Math.random() * Math.PI * 2,
        radius: 18 + Math.random() * 14,
        height: 8 + Math.random() * 6,
        speed: 0.06 + Math.random() * 0.10,
      });
    }
    d.birds = birds;

    // Player starts in center
    const center = tileCenter(d.playerCol, d.playerRow);
    d.playerPos.set(center.x, tileTopY(0), center.z);
    d.initialized = true;
  }

  useFrame((_, delta) => {
    const d = state.current;
    if (!playing || d.gameOver) return;
    const c = Math.min(delta, 0.05);

    d.time += c;

    // ===== TIDE TICK =====
    if (d.time >= d.nextTideAt) {
      d.waterLevelTarget += 1;
      d.nextTideAt += TIDE_INTERVAL;
      playSfx('tide_rise');
      onTideEvent?.();
    }
    // Lerp water level toward target (smooth visual rise)
    if (d.waterLevel < d.waterLevelTarget) {
      d.waterLevel = Math.min(d.waterLevelTarget, d.waterLevel + c * 1.2);
    }

    // ===== PLAYER MOVEMENT =====
    const speed = carrySpeed(d.carrying);
    if (stick.active) {
      const dir = new THREE.Vector3(stick.x, 0, stick.y);
      if (dir.length() > 0.05) {
        d.playerPos.x += dir.x * speed * c;
        d.playerPos.z += dir.z * speed * c;
        d.playerRot = Math.atan2(dir.x, dir.z);
      }
    }
    // Clamp to a bit beyond the grid (let the player fall off)
    const halfWorld = (GRID / 2) * TILE_SIZE + 4;
    d.playerPos.x = Math.max(-halfWorld, Math.min(halfWorld, d.playerPos.x));
    d.playerPos.z = Math.max(-halfWorld, Math.min(halfWorld, d.playerPos.z));

    // Determine which tile the player is over
    const onTile = worldToTile(d.playerPos.x, d.playerPos.z);
    if (onTile) {
      d.playerCol = onTile.col;
      d.playerRow = onTile.row;
    }

    // Stand height: top of the stack under the player IF that tile exists.
    // If off-grid OR if water exceeds the tile, player is "in water".
    const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    let standY = WATER_BASE_Y;
    let inWater = false;
    if (onTile) {
      const stack = d.heights[onTile.col][onTile.row];
      const top = tileTopY(stack);
      standY = top;
      if (waterY > top - DROWN_MARGIN) inWater = true;
    } else {
      // Off the grid → in water
      inWater = true;
      standY = waterY;
    }
    // Smooth y to standY
    d.playerPos.y += (standY - d.playerPos.y) * Math.min(1, c * 12);

    // Track in-water time
    if (inWater) {
      if (d.inWaterTime === 0 && d.time > GRACE_PERIOD) playSfx('splash');
      d.inWaterTime += c;
    } else {
      if (d.inWaterTime > 0.2 && d.time > GRACE_PERIOD) playSfx('splash');
      d.inWaterTime = 0;
    }

    // ===== ITEM SPAWN =====
    if (d.time >= d.nextItemSpawnAt && d.items.length < ITEM_MAX_ACTIVE) {
      d.nextItemSpawnAt = d.time + ITEM_SPAWN_INTERVAL_MIN + Math.random() * (ITEM_SPAWN_INTERVAL_MAX - ITEM_SPAWN_INTERVAL_MIN);
      // Pick a tile that is currently dry (above water) so the item lands somewhere reachable.
      let tries = 0;
      let col = 0, row = 0, stack = 0;
      while (tries++ < 20) {
        col = Math.floor(Math.random() * GRID);
        row = Math.floor(Math.random() * GRID);
        stack = d.heights[col][row];
        const top = tileTopY(stack);
        if (top > waterY - DROWN_MARGIN) break; // dry-ish tile
      }
      const center = tileCenter(col, row);
      const kind = pickItemKind();
      const landY = tileTopY(stack) + 0.05;
      d.items.push({
        id: d.itemIdCounter++,
        kind,
        position: new THREE.Vector3(center.x, landY + ITEM_DROP_HEIGHT, center.z),
        col, row,
        vy: 0,
        landed: false,
        landY,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // ===== ITEM PHYSICS (gravity drop, then bob) =====
    for (const it of d.items) {
      if (!it.landed) {
        it.vy -= 28 * c;
        it.position.y += it.vy * c;
        // Re-evaluate landY in case the stack changed under it
        const stackHere = d.heights[it.col][it.row];
        const top = tileTopY(stackHere) + 0.05;
        it.landY = top;
        if (it.position.y <= it.landY) {
          it.position.y = it.landY;
          it.vy = 0;
          it.landed = true;
        }
      } else {
        // Idle bob
        it.position.y = it.landY + Math.sin(d.time * 2 + it.phase) * 0.02;
      }
    }

    // ===== PICKUP (only if not carrying) =====
    if (!d.carrying && d.time > GRACE_PERIOD * 0.5) {
      for (let i = d.items.length - 1; i >= 0; i--) {
        const it = d.items[i];
        if (!it.landed) continue;
        const dx = it.position.x - d.playerPos.x;
        const dz = it.position.z - d.playerPos.z;
        if (Math.sqrt(dx * dx + dz * dz) < ITEM_PICKUP_RADIUS) {
          // Special: paddle gives tide buffer immediately
          if (it.kind === 'paddle') {
            d.nextTideAt += PADDLE_TIDE_BUFFER;
            playSfx('paddle');
            haptic?.('light');
          } else {
            d.carrying = it.kind;
            playSfx(it.kind === 'boulder' ? 'boulder_lift' : 'thunk');
            haptic?.('light');
            // Lock the drop to the *next* tile — prevents the auto-drop logic
            // from instantly raising the tile we picked up on this same frame.
            if (onTile) (d as any).__lastDropTile = onTile.col * GRID + onTile.row;
          }
          d.items.splice(i, 1);
          break;
        }
      }
    } else if (d.carrying && onTile) {
      // ===== AUTO DROP =====
      // When you stand on a tile while carrying, drop is automatic: each tile
      // can only be raised by a discrete drop event. We mark a "lastDropTile"
      // so you don't multi-stack on the same tile while crossing it.
      const tileId = onTile.col * GRID + onTile.row;
      if ((d as any).__lastDropTile !== tileId) {
        const gain = heightGain(d.carrying);
        if (gain > 0) {
          d.heights[onTile.col][onTile.row] += gain;
          playSfx(d.carrying === 'boulder' ? 'thud' : 'plank_drop');
          haptic?.(d.carrying === 'boulder' ? 'heavy' : 'light');
          (d as any).__lastDropTile = tileId;
          d.carrying = null;
        }
      }
    }
    // Reset drop-lock when player isn't carrying so a second pickup is fresh
    if (!d.carrying) (d as any).__lastDropTile = null;

    // ===== MAX HEIGHT TRACKING =====
    if (onTile) {
      const h = d.heights[onTile.col][onTile.row];
      if (h > d.maxHeightReached) d.maxHeightReached = h;
    }

    // ===== SHARK AI =====
    for (const s of d.sharks) {
      // y stays just under the water surface so the fin shows above
      s.position.y = waterY - 0.25;
      if (inWater && d.time > GRACE_PERIOD) {
        // Lunge toward player
        const dx = d.playerPos.x - s.position.x;
        const dz = d.playerPos.z - s.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.001) {
          const sp = d.inWaterTime > SHARK_DELAY_IN_WATER ? SHARK_LUNGE_SPEED : SHARK_PATROL_SPEED * 1.4;
          s.position.x += (dx / dist) * sp * c;
          s.position.z += (dz / dist) * sp * c;
          s.rotation = Math.atan2(dx, dz);
          s.lunging = true;
        }
      } else {
        // Patrol orbit
        s.orbit.phase += (SHARK_PATROL_SPEED / s.orbit.r) * c;
        const tx = s.orbit.cx + Math.cos(s.orbit.phase) * s.orbit.r;
        const tz = s.orbit.cz + Math.sin(s.orbit.phase) * s.orbit.r;
        s.position.x += (tx - s.position.x) * Math.min(1, c * 2);
        s.position.z += (tz - s.position.z) * Math.min(1, c * 2);
        const tangent = s.orbit.phase + Math.PI / 2;
        s.rotation = Math.atan2(Math.cos(tangent), Math.sin(tangent));
        s.lunging = false;
      }
    }

    // ===== BIRDS =====
    for (const b of d.birds) {
      b.angle += b.speed * c;
    }
    // Occasional gull cry
    if (d.time > d.lastGullAt + 6 + Math.random() * 4) {
      if (Math.random() < 0.5) playSfx('gull_cry');
      d.lastGullAt = d.time;
    }

    // ===== DEATH CHECKS =====
    const endGame = (reason: 'drowned' | 'shark') => {
      if (d.gameOver) return;
      d.gameOver = true;
      d.gameOverReason = reason;
      playSfx('shark_roar');
      playSfx('game_over');
      haptic?.('heavy');
      onGameOver(d.score, reason);
    };

    if (d.time > GRACE_PERIOD && inWater && d.inWaterTime > SHARK_DELAY_IN_WATER) {
      // Check nearest shark distance
      let died = false;
      for (const s of d.sharks) {
        const dx = s.position.x - d.playerPos.x;
        const dz = s.position.z - d.playerPos.z;
        if (Math.sqrt(dx * dx + dz * dz) < SHARK_KILL_RADIUS) {
          died = true; break;
        }
      }
      if (died) {
        onWaterFlash?.('shark');
        endGame('shark');
        return;
      }
    }
    // Drown when fully submerged with no escape — i.e., even highest stack on field is under water
    if (d.time > GRACE_PERIOD) {
      let highestStack = 0;
      for (let cc = 0; cc < GRID; cc++) {
        for (let rr = 0; rr < GRID; rr++) {
          if (d.heights[cc][rr] > highestStack) highestStack = d.heights[cc][rr];
        }
      }
      const highestTop = tileTopY(highestStack);
      if (waterY > highestTop + TILE_THICKNESS * 0.6) {
        onWaterFlash?.('drown');
        endGame('drowned');
        return;
      }
    }

    // ===== SCORE =====
    const newScore = Math.floor(d.time) + d.maxHeightReached * HEIGHT_BONUS;
    if (newScore !== d.score) {
      d.score = newScore;
      onScore(d.score);
    }
  });
}
