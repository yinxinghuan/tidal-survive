import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GRID, TILE_SIZE, TILE_THICKNESS,
  TIDE_INTERVAL, WATER_BASE_Y, WATER_Y_PER_LEVEL, DROWN_MARGIN, GROUND_Y,
  PLAYER_SPEED_NORMAL, PLAYER_SPEED_CARRYING_HEAVY, PLAYER_SPEED_CARRYING_LIGHT,
  SHARK_DELAY_IN_WATER, GRACE_PERIOD,
  ITEM_SPAWN_INTERVAL_MIN, ITEM_SPAWN_INTERVAL_MAX, ITEM_MAX_ACTIVE,
  ITEM_WEIGHTS, ITEM_PICKUP_RADIUS, PADDLE_TIDE_BUFFER,
  ITEM_DRIFT_SPAWN_OFFSET, ITEM_DRIFT_SPEED, ITEM_DRIFT_PARK_DIST, ITEM_FLOAT_Y_OFFSET,
  SHARK_COUNT, SHARK_PATROL_SPEED, SHARK_LUNGE_SPEED, SHARK_KILL_RADIUS, SHARK_ORBIT_R,
  BIRD_COUNT, HEIGHT_BONUS, BOARD_DROWN_BUFFER, SHALLOW_PADDING,
} from '../constants';
import type { Item, ItemKind, Shark, Bird, Stick, Pellet, DustRing, Bubble, TutorialStep } from '../types';

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

// Pre-warning window before a tide event. Bar flashes amber, low rumble plays.
export const TIDE_WARN_LEAD = 1.5;

// Window during which a tile's stack just grew — used by Tile.tsx to play a
// scale-in animation on the new top layer.
export const TILE_GROW_ANIM = 0.28;

export interface GameRef {
  // Grid state — heights[col][row] = how many blocks stacked. 0 = bare sand at base.
  heights: number[][];
  // For each tile, the game-time at which it last grew. Tile.tsx reads this
  // and applies a scale-in to the topmost layer for TILE_GROW_ANIM seconds.
  lastGrowAt: number[][];
  // Player
  playerPos: THREE.Vector3;     // world XYZ; y = top of tile player is on (or water if drowning)
  playerRot: number;
  playerCol: number;
  playerRow: number;
  // Player carry
  carrying: ItemKind | null;
  carryPhase: number;

  // Water level (continuous, lerps toward target on tide events)
  waterLevel: number;           // current displayed level
  waterLevelTarget: number;     // step target after a tide event
  nextTideAt: number;           // game time when level will increment next
  inWaterTime: number;          // seconds player has been in water (resets when dry)
  tideWarnPlayed: number;       // last warn level we already played a rumble for
  tideEventCount: number;       // counts every tide event fired since start
  // v1.7: tide model is "rise to a NEW peak, ebb back to 0, rise to a HIGHER
  // peak, ebb to 0, ..." rather than the old ±1 oscillation. Each cycle =
  // one rise event + one ebb event. The peak grows by 1 every cycle so the
  // game gets harder over time, with a real "everything is fine again" beat
  // between peaks.
  tideCyclePeak: number;        // peak the next RISE will reach (starts at 1)
  isUpcomingEbb: boolean;       // true if the next tide event will be the ebb-to-0
  // Cached "nearest dry tile" while player is in water — drives the white halo
  // hint so the player can see where to flee. {col, row, dist} or null if dry.
  nearestDryWhileWet: { col: number; row: number } | null;

  // Camera shake — additive offsets applied by FollowCamera (decays each frame)
  shakeX: number;
  shakeY: number;
  shakeZ: number;
  // Tide-event camera dip (sinks then bounces back)
  tideDipPhase: number;         // 0 = idle, otherwise t-since dip started
  tideDipMag: number;

  // Items
  items: Item[];
  nextItemSpawnAt: number;
  itemIdCounter: number;

  // Sharks
  sharks: Shark[];

  // Birds (ambient gulls)
  birds: Bird[];

  // Visual feedback (consumed by HUD / Scene each frame)
  pellets: Pellet[];
  dustRings: DustRing[];
  bubbles: Bubble[];
  pelletId: number;
  ringId: number;
  bubbleId: number;
  // Times we last spawned a heartbeat / foot SFX so we can throttle them
  lastHeartbeatAt: number;
  lastFootAt: number;
  lastWadeAt: number;       // last time we pushed a wading splash ring

  // Tap-drop signal: incremented by TidalSurvive.tsx when the joystick gesture
  // ends without significant travel. The game loop polls this counter each
  // frame and, if it's incremented, drops the carry on the current tile.
  tapDropPending: number;
  tapDropConsumed: number;

  // Onboarding
  startRitual: 'idle' | 'ready' | 'go' | 'done';
  startRitualSince: number;     // game-time the current phase began
  // Tutorial overlay step. New player only (Tutorial.tsx persists "seen" flag
  // in localStorage). When step !== 'done', the tide is paused.
  tutorialStep: TutorialStep;
  // For tutorial: the tile we want the player to drop on (set when they pick up)
  tutorialDropTarget: { col: number; row: number } | null;
  // Tutorial scripted item — we spawn a guaranteed plank in the player's path
  // so the pickup step actually has something to teach with.
  tutorialItemId: number | null;

  // Timers + state
  time: number;
  score: number;
  maxHeightReached: number;
  gameOver: boolean;
  gameOverReason: 'drowned' | 'shark' | null;
  lastGullAt: number;
  initialized: boolean;
}

export function createGameState(tutorialEnabled = false): GameRef {
  const heights: number[][] = [];
  const lastGrowAt: number[][] = [];
  for (let c = 0; c < GRID; c++) {
    heights.push(new Array(GRID).fill(0));
    lastGrowAt.push(new Array(GRID).fill(-99));
  }
  return {
    heights,
    lastGrowAt,
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
    tideWarnPlayed: -1,
    tideEventCount: 0,
    tideCyclePeak: 1,
    isUpcomingEbb: false,
    nearestDryWhileWet: null,
    shakeX: 0, shakeY: 0, shakeZ: 0,
    tideDipPhase: 0, tideDipMag: 0,
    items: [],
    nextItemSpawnAt: tutorialEnabled ? 0.6 : 1.5,
    itemIdCounter: 1,
    sharks: [],
    birds: [],
    pellets: [],
    dustRings: [],
    bubbles: [],
    pelletId: 1,
    ringId: 1,
    bubbleId: 1,
    lastHeartbeatAt: 0,
    lastFootAt: 0,
    lastWadeAt: 0,
    tapDropPending: 0,
    tapDropConsumed: 0,
    startRitual: 'ready',
    startRitualSince: 0,
    tutorialStep: tutorialEnabled ? 'move' : 'done',
    tutorialDropTarget: null,
    tutorialItemId: null,
    time: 0,
    score: 0,
    maxHeightReached: 0,
    gameOver: false,
    gameOverReason: null,
    lastGullAt: 0,
    initialized: false,
  };
}

// Build a drifting item for the given target tile. Spawn point is computed
// by extending the (origin → target tile) ray to ITEM_DRIFT_SPAWN_OFFSET
// units OUTSIDE the playfield, so the item visibly drifts in from the open
// water toward the island.
function makeDriftItem(
  id: number, kind: ItemKind,
  targetCol: number, targetRow: number,
  waterY: number,
): Item {
  const center = tileCenter(targetCol, targetRow);
  // Outward direction from origin. If the target is at origin (center of
  // grid), pick a random angle.
  let ox = center.x, oz = center.z;
  const r = Math.sqrt(ox * ox + oz * oz);
  if (r < 0.01) {
    const a = Math.random() * Math.PI * 2;
    ox = Math.cos(a); oz = Math.sin(a);
  } else {
    ox /= r; oz /= r;
  }
  // Place spawn point beyond the target by SPAWN_OFFSET. World units.
  const halfWorld = (GRID / 2) * TILE_SIZE;
  const spawnRadius = halfWorld + ITEM_DRIFT_SPAWN_OFFSET;
  const spawnX = ox * spawnRadius;
  const spawnZ = oz * spawnRadius;
  return {
    id, kind,
    position: new THREE.Vector3(spawnX, waterY + ITEM_FLOAT_Y_OFFSET, spawnZ),
    col: targetCol, row: targetRow,
    drifting: true,
    targetX: center.x,
    targetZ: center.z,
    phase: Math.random() * Math.PI * 2,
    nextRippleAt: 0,   // first ripple fires soon after parking
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

function pushPellet(d: GameRef, kind: 'pick' | 'height' | 'paddle', text: string, x: number, y: number, z: number) {
  d.pellets.push({
    id: d.pelletId++,
    kind, text, worldX: x, worldY: y, worldZ: z,
    startTime: d.time,
  });
  // Keep cap so the array doesn't grow
  if (d.pellets.length > 24) d.pellets.shift();
}

function pushRing(d: GameRef, kind: 'dust' | 'splash' | 'tide', x: number, y: number, z: number) {
  d.dustRings.push({
    id: d.ringId++,
    kind, worldX: x, worldY: y, worldZ: z,
    startTime: d.time,
  });
  if (d.dustRings.length > 16) d.dustRings.shift();
}

// Scatter a cluster of white foam bubbles around (x, y, z). Each bubble has
// a small random offset, a random max radius, and grows from 0 → maxRadius
// then fades out. Spawned alongside splash rings to give the water surface
// a frothy/aerated feel instead of just smooth dark waves.
function pushSplashBubbles(d: GameRef, x: number, y: number, z: number, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.2 + Math.random() * 0.9;
    d.bubbles.push({
      id: d.bubbleId++,
      worldX: x, worldY: y, worldZ: z,
      offsetX: Math.cos(a) * r,
      offsetZ: Math.sin(a) * r,
      maxRadius: 0.06 + Math.random() * 0.10,
      life: 0.5 + Math.random() * 0.5,
      startTime: d.time,
    });
  }
  if (d.bubbles.length > 80) d.bubbles.splice(0, d.bubbles.length - 80);
}

function shake(d: GameRef, amount: number) {
  d.shakeX = Math.max(d.shakeX, amount);
  d.shakeY = Math.max(d.shakeY, amount * 0.6);
  d.shakeZ = Math.max(d.shakeZ, amount);
}

export interface GameLoopParams {
  state: React.MutableRefObject<GameRef>;
  playing: boolean;
  stick: Stick;
  onScore: (s: number) => void;
  onGameOver: (finalScore: number, reason: 'drowned' | 'shark') => void;
  onWaterFlash?: (kind: 'shark' | 'drown') => void;
  onTideEvent?: () => void;
  // True when the in-water shark countdown should be visible in the HUD.
  // Fires every frame so the parent component can read it via the state ref.
  playSfx: (key:
    | 'splash' | 'thunk' | 'thud' | 'plank_drop' | 'boulder_lift'
    | 'paddle' | 'tide_warn' | 'tide_rise' | 'shark_roar' | 'heartbeat'
    | 'foot_dry' | 'carry_grunt' | 'ready' | 'go' | 'gull_cry' | 'game_over') => void;
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

    // v1.5: starter plank — drifts in from the water toward an edge tile
    // near the player. v1.7.1 forces edge to make the parked position land
    // in open water (otherwise it parks on a dry interior tile).
    if (d.tutorialStep === 'done') {
      // Pick the nearest east-edge tile in the same row as the player.
      const startCol = GRID - 1;
      const startRow = d.playerRow;
      const waterY0 = WATER_BASE_Y; // game starts at waterLevel = 0
      d.items.push(makeDriftItem(d.itemIdCounter++, 'plank', startCol, startRow, waterY0));
    }

    d.initialized = true;
  }

  useFrame((_, delta) => {
    const d = state.current;
    if (!playing || d.gameOver) return;
    const c = Math.min(delta, 0.05);

    d.time += c;

    // ===== START RITUAL (READY / GO) =====
    // During 'ready' (1.0s) and 'go' (0.5s) the tide clock is paused and the
    // player can already move around. SFX cue at each transition.
    if (d.startRitual !== 'done') {
      const phaseAge = d.time - d.startRitualSince;
      if (d.startRitual === 'ready') {
        if (phaseAge === 0 || (phaseAge < c * 1.5 && d.startRitualSince === 0)) {
          // First frame
          playSfx('ready');
        }
        if (phaseAge >= 1.0) {
          d.startRitual = 'go';
          d.startRitualSince = d.time;
          playSfx('go');
        }
      } else if (d.startRitual === 'go') {
        if (phaseAge >= 0.5) {
          d.startRitual = 'done';
        }
      }
      // While ritual is active, freeze tide clock (push it forward with c each frame).
      d.nextTideAt += c;
    }

    // ===== TIDE WARN + TICK =====
    // The tide clock is paused only during the *teaching* tutorial steps
    // (move / pickup / drop). Once the player has reached step 'tide' the
    // clock runs so the first tide event can fire and the lesson lands.
    const tideClockRunning = d.tutorialStep === 'done' || d.tutorialStep === 'tide';
    if (tideClockRunning) {
      // v1.7 cycle: each tide event alternates between RISE-to-peak and
      // EBB-to-0. After every ebb, the next peak is 1 higher than the last.
      // So the rises grow: 1, 2, 3, 4, ... and every ebb resets to 0.
      d.isUpcomingEbb = d.waterLevelTarget > 0; // at peak → next is ebb
      const upcomingId = d.tideEventCount + 1;
      if (
        d.tideWarnPlayed !== upcomingId &&
        d.nextTideAt - d.time <= TIDE_WARN_LEAD &&
        d.nextTideAt - d.time > 0
      ) {
        d.tideWarnPlayed = upcomingId;
        playSfx('tide_warn');
      }

      if (d.time >= d.nextTideAt) {
        const isEbb = d.isUpcomingEbb;
        if (isEbb) {
          d.waterLevelTarget = 0;
          d.tideCyclePeak += 1;  // next rise will be higher
        } else {
          d.waterLevelTarget = d.tideCyclePeak;
        }
        d.tideEventCount += 1;
        d.nextTideAt += TIDE_INTERVAL;
        playSfx(isEbb ? 'paddle' : 'tide_rise');
        onTideEvent?.();
        pushRing(d, 'tide', 0, WATER_BASE_Y + d.waterLevelTarget * WATER_Y_PER_LEVEL, 0);
        d.tideDipPhase = 0.001;
        d.tideDipMag = isEbb ? 0.25 : 0.45;
        shake(d, isEbb ? 0.10 : 0.25);
        haptic?.('light');
      }
    } else {
      d.nextTideAt += c;
    }

    // Lerp water level toward target — covers BOTH rise and ebb directions.
    if (d.waterLevel < d.waterLevelTarget) {
      d.waterLevel = Math.min(d.waterLevelTarget, d.waterLevel + c * 1.2);
    } else if (d.waterLevel > d.waterLevelTarget) {
      d.waterLevel = Math.max(d.waterLevelTarget, d.waterLevel - c * 1.2);
    }

    // ===== CAMERA SHAKE / DIP DECAY =====
    d.shakeX *= Math.pow(0.001, c);
    d.shakeY *= Math.pow(0.001, c);
    d.shakeZ *= Math.pow(0.001, c);
    if (d.tideDipPhase > 0) {
      d.tideDipPhase += c;
      if (d.tideDipPhase > 0.9) { d.tideDipPhase = 0; d.tideDipMag = 0; }
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
    const halfWorld = (GRID / 2) * TILE_SIZE + 4;
    d.playerPos.x = Math.max(-halfWorld, Math.min(halfWorld, d.playerPos.x));
    d.playerPos.z = Math.max(-halfWorld, Math.min(halfWorld, d.playerPos.z));

    // Determine which tile the player is over
    const onTile = worldToTile(d.playerPos.x, d.playerPos.z);
    if (onTile) {
      d.playerCol = onTile.col;
      d.playerRow = onTile.row;
    }

    // Stand height
    const waterY = WATER_BASE_Y + d.waterLevel * WATER_Y_PER_LEVEL;
    let standY = WATER_BASE_Y;
    let inWater = false;
    let inShallow = false;
    if (onTile) {
      const stack = d.heights[onTile.col][onTile.row];
      const top = tileTopY(stack);
      standY = top;
      if (waterY > top - DROWN_MARGIN) inWater = true;
    } else {
      inWater = true;
      standY = waterY;
      // v1.9: SHALLOW zone — 1 tile padding past the grid where wading is
      // safe. Visual splash effects still fire, but the shark countdown
      // does not accumulate. This is the "safe wading" ring the player can
      // venture into to grab items without committing to deep water.
      const halfGrid = (GRID / 2) * TILE_SIZE;
      const beyondShallowX = Math.abs(d.playerPos.x) > halfGrid + SHALLOW_PADDING;
      const beyondShallowZ = Math.abs(d.playerPos.z) > halfGrid + SHALLOW_PADDING;
      if (!beyondShallowX && !beyondShallowZ) inShallow = true;
    }
    d.playerPos.y += (standY - d.playerPos.y) * Math.min(1, c * 12);

    // Track in-water time (only after the start ritual is past)
    // v1.9: SHALLOW water doesn't accumulate inWaterTime. The shark threat
    // is reserved for DEEP water past the shallow padding.
    const beyondStart = d.startRitual === 'done' && d.time > GRACE_PERIOD;
    const inDeep = inWater && !inShallow;
    if (inWater) {
      if (d.inWaterTime === 0 && beyondStart) {
        playSfx('splash');
        // Visual splash fires for ANY water entry, shallow or deep
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
        pushSplashBubbles(d, d.playerPos.x, waterY + 0.08, d.playerPos.z, 10);
      }
      if (inDeep) d.inWaterTime += c;
      else d.inWaterTime = 0;
      // Continuous wading wake — small splash puff + a few bubbles
      if (stick.active && Math.hypot(stick.x, stick.y) > 0.3 &&
          d.time > d.lastWadeAt + 0.25) {
        d.lastWadeAt = d.time;
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.04, d.playerPos.z);
        pushSplashBubbles(d, d.playerPos.x, waterY + 0.06, d.playerPos.z, 3);
      }
    } else {
      if (d.inWaterTime > 0.2 && beyondStart) {
        playSfx('splash');
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
        pushSplashBubbles(d, d.playerPos.x, waterY + 0.08, d.playerPos.z, 8);
      }
      d.inWaterTime = 0;
    }

    // ===== HEARTBEAT in water (after danger threshold approaches) =====
    if (inWater && d.inWaterTime > 0.4 && d.time > d.lastHeartbeatAt + 0.6) {
      playSfx('heartbeat');
      d.lastHeartbeatAt = d.time;
    }

    // ===== NEAREST DRY TILE while in water — drives the "where to flee" halo =====
    if (inWater) {
      let bestDist = Infinity;
      let bestCol = -1, bestRow = -1;
      for (let cc = 0; cc < GRID; cc++) {
        for (let rr = 0; rr < GRID; rr++) {
          const top = tileTopY(d.heights[cc][rr]);
          if (top <= waterY + DROWN_MARGIN * 0.5) continue; // wet
          const center = tileCenter(cc, rr);
          const dx = center.x - d.playerPos.x;
          const dz = center.z - d.playerPos.z;
          const dist = dx * dx + dz * dz;
          if (dist < bestDist) {
            bestDist = dist;
            bestCol = cc; bestRow = rr;
          }
        }
      }
      d.nearestDryWhileWet = bestCol >= 0 ? { col: bestCol, row: bestRow } : null;
    } else {
      d.nearestDryWhileWet = null;
    }

    // ===== FOOTFALL on dry ground (throttled, only when actually moving) =====
    if (!inWater && stick.active && Math.hypot(stick.x, stick.y) > 0.4) {
      const interval = d.carrying === 'boulder' ? 0.55 : 0.38;
      if (d.time > d.lastFootAt + interval) {
        playSfx('foot_dry');
        d.lastFootAt = d.time;
      }
    }

    // ===== ITEM SPAWN =====
    // v1.4: collect ALL currently-dry tiles, then pick one uniformly. If
    // every tile is flooded, fall back to the highest-stack tile (driest
    // available). Previous "random + retry up to 20" was failing in the
    // late game because most tiles are wet and the loop terminated on a
    // wet tile, dropping items into the ocean.
    if (d.time >= d.nextItemSpawnAt && d.items.length < ITEM_MAX_ACTIVE && d.tutorialStep === 'done') {
      d.nextItemSpawnAt = d.time + ITEM_SPAWN_INTERVAL_MIN + Math.random() * (ITEM_SPAWN_INTERVAL_MAX - ITEM_SPAWN_INTERVAL_MIN);
      // v1.7.1: items MUST target EDGE tiles so the parked position lands in
      // open water past the island, forcing the player to wade-pickup. An
      // interior target made the item park inside the grid on a dry tile,
      // which felt like a normal dry-ground pickup.
      const edgeDryTiles: { col: number; row: number }[] = [];
      const allEdgeTiles: { col: number; row: number }[] = [];
      for (let cc = 0; cc < GRID; cc++) {
        for (let rr = 0; rr < GRID; rr++) {
          const isEdge = cc === 0 || cc === GRID - 1 || rr === 0 || rr === GRID - 1;
          if (!isEdge) continue;
          allEdgeTiles.push({ col: cc, row: rr });
          const top = tileTopY(d.heights[cc][rr]);
          if (top > waterY + DROWN_MARGIN * 0.5) {
            edgeDryTiles.push({ col: cc, row: rr });
          }
        }
      }
      let col: number, row: number;
      const pool = edgeDryTiles.length > 0 ? edgeDryTiles : allEdgeTiles;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      col = pick.col; row = pick.row;
      const kind = pickItemKind();
      d.items.push(makeDriftItem(d.itemIdCounter++, kind, col, row, waterY));
    }

    // ===== TUTORIAL SCRIPTED PLANK (step 'pickup' guarantees a plank near player) =====
    if (d.tutorialStep === 'pickup' && d.tutorialItemId === null && d.items.length < ITEM_MAX_ACTIVE) {
      // v1.7.1: force edge tile so the plank parks in water (consistent with
      // the live spawn logic and the "reach into water" teaching).
      const targetCol = GRID - 1;
      const targetRow = d.playerRow;
      const id = d.itemIdCounter++;
      d.items.push(makeDriftItem(id, 'plank', targetCol, targetRow, waterY));
      d.tutorialItemId = id;
    }

    // ===== ITEM PHYSICS (drift + float) =====
    for (const it of d.items) {
      const yBob = Math.sin(d.time * 1.8 + it.phase) * 0.05;
      if (it.drifting) {
        // If the target tile drowned mid-drift, retarget to the nearest dry
        // tile so the item doesn't park somewhere the player can't reach.
        const targetStack = d.heights[it.col][it.row];
        const targetTop = tileTopY(targetStack);
        if (targetTop <= waterY + DROWN_MARGIN * 0.5) {
          let bestDist = Infinity;
          let bestCol = it.col, bestRow = it.row;
          for (let cc = 0; cc < GRID; cc++) {
            for (let rr = 0; rr < GRID; rr++) {
              const top = tileTopY(d.heights[cc][rr]);
              if (top <= waterY + DROWN_MARGIN * 0.5) continue;
              const center = tileCenter(cc, rr);
              const dx = center.x - it.position.x;
              const dz = center.z - it.position.z;
              const dist = dx * dx + dz * dz;
              if (dist < bestDist) {
                bestDist = dist;
                bestCol = cc; bestRow = rr;
              }
            }
          }
          if (bestDist < Infinity) {
            const newCenter = tileCenter(bestCol, bestRow);
            it.col = bestCol; it.row = bestRow;
            it.targetX = newCenter.x; it.targetZ = newCenter.z;
          }
        }

        const dx = it.targetX - it.position.x;
        const dz = it.targetZ - it.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < ITEM_DRIFT_PARK_DIST) {
          it.drifting = false;
          pushRing(d, 'splash', it.position.x, waterY + 0.05, it.position.z);
          pushSplashBubbles(d, it.position.x, waterY + 0.08, it.position.z, 6);
          it.nextRippleAt = d.time + 1.2;
        } else {
          const nx = dx / dist;
          const nz = dz / dist;
          it.position.x += nx * ITEM_DRIFT_SPEED * c;
          it.position.z += nz * ITEM_DRIFT_SPEED * c;
        }
      } else if (d.time >= it.nextRippleAt) {
        // Parked floating item — periodic small ripple so the water surface
        // visibly reacts to the object resting on it.
        pushRing(d, 'splash', it.position.x, waterY + 0.04, it.position.z);
        it.nextRippleAt = d.time + 1.5 + Math.random() * 0.8;
      }
      it.position.y = waterY + ITEM_FLOAT_Y_OFFSET + yBob;
    }

    // ===== PICKUP =====
    // v1.5: items can be picked up once parked (no longer drifting in). The
    // player can pick up from any nearby position — they don't have to be
    // standing on the same tile. ITEM_PICKUP_RADIUS is the leash.
    if (!d.carrying && d.time > GRACE_PERIOD * 0.3) {
      for (let i = d.items.length - 1; i >= 0; i--) {
        const it = d.items[i];
        if (it.drifting) continue;
        const dx = it.position.x - d.playerPos.x;
        const dz = it.position.z - d.playerPos.z;
        if (Math.sqrt(dx * dx + dz * dz) < ITEM_PICKUP_RADIUS) {
          if (it.kind === 'paddle') {
            d.nextTideAt += PADDLE_TIDE_BUFFER;
            playSfx('paddle');
            haptic?.('light');
            pushPellet(d, 'paddle', `+${PADDLE_TIDE_BUFFER}s TIDE`, it.position.x, it.position.y + 0.6, it.position.z);
            pushRing(d, 'dust', it.position.x, it.position.y, it.position.z);
            shake(d, 0.08);
          } else {
            d.carrying = it.kind;
            playSfx(it.kind === 'boulder' ? 'boulder_lift' : 'thunk');
            haptic?.('light');
            pushPellet(d, 'pick', it.kind === 'boulder' ? '+2 PICK' : '+1 PICK', it.position.x, it.position.y + 0.6, it.position.z);
            pushRing(d, 'dust', it.position.x, it.position.y, it.position.z);
            // Tutorial: advance from 'pickup' to 'drop'
            if (d.tutorialStep === 'pickup' && it.id === d.tutorialItemId) {
              d.tutorialStep = 'drop';
              // Pick a drop target adjacent to the pickup tile (player's col-1 row)
              const tCol = Math.max(0, Math.min(GRID - 1, it.col - 2));
              d.tutorialDropTarget = { col: tCol, row: it.row };
              d.tutorialItemId = null;
            }
          }
          d.items.splice(i, 1);
          break;
        }
      }
    } else if (d.carrying && onTile && d.tapDropPending > d.tapDropConsumed) {
      // v1.3: tap-to-drop. The joystick's `onTap` (release without drag)
      // increments `tapDropPending`. We consume one each frame the loop sees
      // a fresh tap, drop on the current tile, and DON'T fire on traversal.
      // This lets the player carry a plank across the island without losing
      // it to whichever intermediate tile they cross.
      d.tapDropConsumed = d.tapDropPending;
      const gain = heightGain(d.carrying);
      if (gain > 0) {
        d.heights[onTile.col][onTile.row] += gain;
        d.lastGrowAt[onTile.col][onTile.row] = d.time;
        playSfx(d.carrying === 'boulder' ? 'thud' : 'plank_drop');
        if (d.carrying === 'boulder') playSfx('carry_grunt');
        haptic?.(d.carrying === 'boulder' ? 'heavy' : 'light');
        const center = tileCenter(onTile.col, onTile.row);
        const newTop = tileTopY(d.heights[onTile.col][onTile.row]);
        pushPellet(d, 'height', `+${gain * HEIGHT_BONUS}`, center.x, newTop + 0.6, center.z);
        pushRing(d, 'dust', center.x, GROUND_Y, center.z);
        shake(d, d.carrying === 'boulder' ? 0.35 : 0.18);
        d.carrying = null;
        // Tutorial advance
        if (d.tutorialStep === 'drop') {
          d.tutorialStep = 'tide';
          d.tutorialDropTarget = null;
          d.nextTideAt = d.time + 2.5;
        }
      }
    }
    // Keep the consumed counter in sync if the player taps without carrying
    if (!d.carrying && d.tapDropPending > d.tapDropConsumed) {
      d.tapDropConsumed = d.tapDropPending;
    }

    // ===== TUTORIAL STATE TRANSITIONS =====
    if (d.tutorialStep === 'move' && stick.active && d.time > 0.4) {
      // Player started using the stick → advance
      d.tutorialStep = 'pickup';
    }
    if (d.tutorialStep === 'tide') {
      // Wait for one tide event to fire, then mark done
      if (d.waterLevelTarget >= 1) {
        d.tutorialStep = 'done';
        // Schedule normal tide cadence from now on
      }
    }

    // ===== MAX HEIGHT TRACKING =====
    if (onTile) {
      const h = d.heights[onTile.col][onTile.row];
      if (h > d.maxHeightReached) d.maxHeightReached = h;
    }

    // ===== SHARK AI =====
    // Find the nearest shark to the player — only that one is allowed to
    // lunge. Others keep patrolling so the threat is directional, not 360°.
    // v1.9: only DEEP water counts. Shallow wading is safe.
    let nearestSharkId = -1;
    if (inDeep && beyondStart && d.inWaterTime > SHARK_DELAY_IN_WATER) {
      let nearestDist = Infinity;
      for (const s of d.sharks) {
        const dx = d.playerPos.x - s.position.x;
        const dz = d.playerPos.z - s.position.z;
        const dist = dx * dx + dz * dz;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestSharkId = s.id;
        }
      }
    }

    for (const s of d.sharks) {
      s.position.y = waterY - 0.25;
      // The countdown phase (inWaterTime ≤ SHARK_DELAY) is a "look but don't
      // approach" window — sharks stay on their orbit, only their rotation
      // turns toward the player. This gives the player a real chance to swim
      // back to dry land within the 2s.
      const inCountdown = inDeep && beyondStart && d.inWaterTime > 0 && d.inWaterTime <= SHARK_DELAY_IN_WATER;
      const isLungingShark = s.id === nearestSharkId;

      if (isLungingShark) {
        // Lunge: head straight for player at SHARK_LUNGE_SPEED
        const dx = d.playerPos.x - s.position.x;
        const dz = d.playerPos.z - s.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.001) {
          s.position.x += (dx / dist) * SHARK_LUNGE_SPEED * c;
          s.position.z += (dz / dist) * SHARK_LUNGE_SPEED * c;
          s.rotation = Math.atan2(dx, dz);
          s.lunging = true;
        }
      } else {
        // Patrol — keep walking the orbit ring
        s.orbit.phase += (SHARK_PATROL_SPEED / s.orbit.r) * c;
        const tx = s.orbit.cx + Math.cos(s.orbit.phase) * s.orbit.r;
        const tz = s.orbit.cz + Math.sin(s.orbit.phase) * s.orbit.r;
        s.position.x += (tx - s.position.x) * Math.min(1, c * 2);
        s.position.z += (tz - s.position.z) * Math.min(1, c * 2);
        // During the countdown, the nearest shark visibly *turns* toward the
        // player even though it isn't closing distance — readable telegraph.
        if (inCountdown) {
          const dx = d.playerPos.x - s.position.x;
          const dz = d.playerPos.z - s.position.z;
          s.rotation = Math.atan2(dx, dz);
          s.lunging = false;
        } else {
          const tangent = s.orbit.phase + Math.PI / 2;
          s.rotation = Math.atan2(Math.cos(tangent), Math.sin(tangent));
          s.lunging = false;
        }
      }
    }

    // ===== BIRDS =====
    for (const b of d.birds) {
      b.angle += b.speed * c;
    }
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

    if (beyondStart && inDeep && d.inWaterTime > SHARK_DELAY_IN_WATER) {
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
    if (beyondStart) {
      let highestStack = 0;
      for (let cc = 0; cc < GRID; cc++) {
        for (let rr = 0; rr < GRID; rr++) {
          if (d.heights[cc][rr] > highestStack) highestStack = d.heights[cc][rr];
        }
      }
      const highestTop = tileTopY(highestStack);
      if (waterY > highestTop + BOARD_DROWN_BUFFER) {
        onWaterFlash?.('drown');
        endGame('drowned');
        return;
      }
    }

    // ===== EXPIRE old pellets/rings/bubbles =====
    const pelletLife = 1.0;
    const ringLife = 0.9;
    while (d.pellets.length && d.time - d.pellets[0].startTime > pelletLife) d.pellets.shift();
    while (d.dustRings.length && d.time - d.dustRings[0].startTime > ringLife) d.dustRings.shift();
    while (d.bubbles.length && d.time - d.bubbles[0].startTime > d.bubbles[0].life) d.bubbles.shift();

    // ===== SCORE =====
    const newScore = Math.floor(d.time) + d.maxHeightReached * HEIGHT_BONUS;
    if (newScore !== d.score) {
      d.score = newScore;
      onScore(d.score);
    }
  });
}
