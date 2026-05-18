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
  BIRD_COUNT, HEIGHT_BONUS, BOARD_DROWN_BUFFER,
} from '../constants';
import type { Item, ItemKind, Shark, Bird, Stick, Pellet, DustRing, TutorialStep } from '../types';

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
  pelletId: number;
  ringId: number;
  // Times we last spawned a heartbeat / foot SFX so we can throttle them
  lastHeartbeatAt: number;
  lastFootAt: number;

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
    shakeX: 0, shakeY: 0, shakeZ: 0,
    tideDipPhase: 0, tideDipMag: 0,
    items: [],
    nextItemSpawnAt: tutorialEnabled ? 0.6 : 1.5,
    itemIdCounter: 1,
    sharks: [],
    birds: [],
    pellets: [],
    dustRings: [],
    pelletId: 1,
    ringId: 1,
    lastHeartbeatAt: 0,
    lastFootAt: 0,
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

    // v1.3: starter plank — outside the tutorial flow, drop a guaranteed
    // plank two tiles ahead of the player at game start. So the first thing
    // the player does is interact with the loop, not stare at empty sand.
    if (d.tutorialStep === 'done') {
      const startCol = Math.min(GRID - 1, d.playerCol + 2);
      const startRow = d.playerRow;
      const cc = tileCenter(startCol, startRow);
      d.items.push({
        id: d.itemIdCounter++,
        kind: 'plank',
        position: new THREE.Vector3(cc.x, tileTopY(0) + 0.05 + ITEM_DROP_HEIGHT, cc.z),
        col: startCol, row: startRow,
        vy: 0, landed: false, landY: tileTopY(0) + 0.05,
        phase: 0,
      });
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
      const upcomingLevel = d.waterLevelTarget + 1;
      if (
        d.tideWarnPlayed !== upcomingLevel &&
        d.nextTideAt - d.time <= TIDE_WARN_LEAD &&
        d.nextTideAt - d.time > 0
      ) {
        d.tideWarnPlayed = upcomingLevel;
        playSfx('tide_warn');
      }

      if (d.time >= d.nextTideAt) {
        d.waterLevelTarget += 1;
        d.nextTideAt += TIDE_INTERVAL;
        playSfx('tide_rise');
        onTideEvent?.();
        pushRing(d, 'tide', 0, WATER_BASE_Y + d.waterLevelTarget * WATER_Y_PER_LEVEL, 0);
        d.tideDipPhase = 0.001;
        d.tideDipMag = 0.45;
        shake(d, 0.25);
        haptic?.('light');
      }
    } else {
      d.nextTideAt += c;
    }

    // Lerp water level toward target (smooth visual rise)
    if (d.waterLevel < d.waterLevelTarget) {
      d.waterLevel = Math.min(d.waterLevelTarget, d.waterLevel + c * 1.2);
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
    if (onTile) {
      const stack = d.heights[onTile.col][onTile.row];
      const top = tileTopY(stack);
      standY = top;
      if (waterY > top - DROWN_MARGIN) inWater = true;
    } else {
      inWater = true;
      standY = waterY;
    }
    d.playerPos.y += (standY - d.playerPos.y) * Math.min(1, c * 12);

    // Track in-water time (only after the start ritual is past)
    const beyondStart = d.startRitual === 'done' && d.time > GRACE_PERIOD;
    if (inWater) {
      if (d.inWaterTime === 0 && beyondStart) {
        playSfx('splash');
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
      }
      d.inWaterTime += c;
    } else {
      if (d.inWaterTime > 0.2 && beyondStart) {
        playSfx('splash');
        pushRing(d, 'splash', d.playerPos.x, waterY + 0.05, d.playerPos.z);
      }
      d.inWaterTime = 0;
    }

    // ===== HEARTBEAT in water (after danger threshold approaches) =====
    if (inWater && d.inWaterTime > 0.4 && d.time > d.lastHeartbeatAt + 0.6) {
      playSfx('heartbeat');
      d.lastHeartbeatAt = d.time;
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
    // Tutorial steps own their own spawns (scripted plank). Random spawns only
    // resume once the tutorial is done (or it was never on).
    if (d.time >= d.nextItemSpawnAt && d.items.length < ITEM_MAX_ACTIVE && d.tutorialStep === 'done') {
      d.nextItemSpawnAt = d.time + ITEM_SPAWN_INTERVAL_MIN + Math.random() * (ITEM_SPAWN_INTERVAL_MAX - ITEM_SPAWN_INTERVAL_MIN);
      let tries = 0;
      let col = 0, row = 0, stack = 0;
      while (tries++ < 20) {
        col = Math.floor(Math.random() * GRID);
        row = Math.floor(Math.random() * GRID);
        stack = d.heights[col][row];
        const top = tileTopY(stack);
        if (top > waterY - DROWN_MARGIN) break;
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

    // ===== TUTORIAL SCRIPTED PLANK (step 'pickup' guarantees a plank near player) =====
    if (d.tutorialStep === 'pickup' && d.tutorialItemId === null && d.items.length < ITEM_MAX_ACTIVE) {
      // Place a plank 2 tiles in front of the player (or center area)
      const targetCol = Math.min(GRID - 1, Math.max(0, d.playerCol + 2));
      const targetRow = d.playerRow;
      const cc = tileCenter(targetCol, targetRow);
      const id = d.itemIdCounter++;
      d.items.push({
        id, kind: 'plank',
        position: new THREE.Vector3(cc.x, tileTopY(0) + 0.05 + ITEM_DROP_HEIGHT, cc.z),
        col: targetCol, row: targetRow,
        vy: 0, landed: false, landY: tileTopY(0) + 0.05,
        phase: 0,
      });
      d.tutorialItemId = id;
    }

    // ===== ITEM PHYSICS =====
    for (const it of d.items) {
      if (!it.landed) {
        it.vy -= 28 * c;
        it.position.y += it.vy * c;
        const stackHere = d.heights[it.col][it.row];
        const top = tileTopY(stackHere) + 0.05;
        it.landY = top;
        if (it.position.y <= it.landY) {
          it.position.y = it.landY;
          it.vy = 0;
          it.landed = true;
          // Subtle dust ring on land
          pushRing(d, 'dust', it.position.x, it.position.y, it.position.z);
        }
      } else {
        it.position.y = it.landY + Math.sin(d.time * 2 + it.phase) * 0.02;
      }
    }

    // ===== PICKUP =====
    if (!d.carrying && d.time > GRACE_PERIOD * 0.3) {
      for (let i = d.items.length - 1; i >= 0; i--) {
        const it = d.items[i];
        if (!it.landed) continue;
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
    let nearestSharkId = -1;
    if (inWater && beyondStart && d.inWaterTime > SHARK_DELAY_IN_WATER) {
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
      const inCountdown = inWater && beyondStart && d.inWaterTime > 0 && d.inWaterTime <= SHARK_DELAY_IN_WATER;
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

    if (beyondStart && inWater && d.inWaterTime > SHARK_DELAY_IN_WATER) {
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

    // ===== EXPIRE old pellets/rings (so the arrays don't grow forever) =====
    const pelletLife = 1.0;
    const ringLife = 0.9;
    while (d.pellets.length && d.time - d.pellets[0].startTime > pelletLife) d.pellets.shift();
    while (d.dustRings.length && d.time - d.dustRings[0].startTime > ringLife) d.dustRings.shift();

    // ===== SCORE =====
    const newScore = Math.floor(d.time) + d.maxHeightReached * HEIGHT_BONUS;
    if (newScore !== d.score) {
      d.score = newScore;
      onScore(d.score);
    }
  });
}
