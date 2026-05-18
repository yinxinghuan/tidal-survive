// Tidal Survive — grid island slowly drowning under rising tide.
// 8x8 height grid, water rises every TIDE_INTERVAL seconds.

export const GRID = 8;                  // 8 x 8 grid
export const TILE_SIZE = 3;             // world units per tile
export const PLAYFIELD = GRID * TILE_SIZE; // 24
export const TILE_THICKNESS = 0.45;     // visual block thickness per stack unit

// The "ground" — top of a bare (stack=0) tile, where the player stands at start.
export const GROUND_Y = 0;

// Tide
// v1.3: 5s → 6s per tide so each level lasts a beat longer.
export const TIDE_INTERVAL = 6;
export const TIDE_RISE_DURATION = 0.8;
// v1.3: WATER_BASE_Y pushed deeper (-0.6 → -1.05) so bare tiles survive the
// first TWO tide events. Level 3 (~18s) is the first time the bare ground
// floods, giving new players a real onboarding window before they must
// have stacked anything.
//
// Schedule with WATER_Y_PER_LEVEL = TILE_THICKNESS (0.45):
//   level 0 → y = -1.05 (deep)
//   level 1 → y = -0.60
//   level 2 → y = -0.15
//   level 3 → y = +0.30  ← bare tile (top=0) finally floods, need stack 1
//   level 4 → y = +0.75  ← need stack 2
//   level 5 → y = +1.20  ← need stack 3
export const WATER_BASE_Y = -1.05;
export const WATER_Y_PER_LEVEL = TILE_THICKNESS;
// Drown threshold: a tile is "drowned" once water.y > stackTop - margin.
export const DROWN_MARGIN = 0.08;
// Buffer applied to the global "no dry land anywhere" game-over check. v1.3
// raised this from 0.6 → 1.0 × TILE_THICKNESS so the player has a real
// "wading in panic" window before the board hard-overs them.
export const BOARD_DROWN_BUFFER = TILE_THICKNESS * 1.0;

// v1.4: tide ebb cycle. Every Nth tide event REDUCES the water level by 1
// instead of raising it — gives the player a breather and matches the real
// physics of tides ("Tidal Survive" should literally have tides).
// Pattern: +1, +1, -1, +1, +1, -1, ... so net rise is +1 level per 3 events.
// The first ebb fires on tide #3, the next on tide #6, etc.
export const TIDE_EBB_PERIOD = 3;

// Player
export const PLAYER_SPEED_NORMAL = 8.0;
export const PLAYER_SPEED_CARRYING_HEAVY = 4.5; // boulder
export const PLAYER_SPEED_CARRYING_LIGHT = 7.2; // plank / paddle
export const PLAYER_RADIUS = 0.5;
// v1.4: 2 → 3s — give the player a real beat to spot the nearest dry tile and
// sprint there before the shark commits to its lunge.
export const SHARK_DELAY_IN_WATER = 3.0;
// Grace at game start
export const GRACE_PERIOD = 1.5;

// Items
export const ITEM_SPAWN_INTERVAL_MIN = 3;
export const ITEM_SPAWN_INTERVAL_MAX = 5;
export const ITEM_MAX_ACTIVE = 6;
// Spawn weights — sum doesn't have to be 1. v1.3 doubled paddle weight (1 → 2)
// because it's the only "panic button" out of a tide and was too rare to land.
export const ITEM_WEIGHTS = { plank: 6, boulder: 3, paddle: 2 };
export const PADDLE_TIDE_BUFFER = 5.0; // seconds added to nextTide on pickup
export const ITEM_PICKUP_RADIUS = 1.1;

// Item drop visual — items fall onto the highest tile under spawn col/row.
export const ITEM_DROP_HEIGHT = 12;

// Sharks
export const SHARK_COUNT = 3;
export const SHARK_PATROL_SPEED = 2.6;
// Lunge speed used when the player has been in water past SHARK_DELAY.
// v1.2 dropped 9→5; v1.4 drops 5→4 because the player usually enters water
// right next to the nearest shark — at 5 the bite hit at ~0.8s post-grace.
export const SHARK_LUNGE_SPEED = 4;
export const SHARK_FIN_HEIGHT = 0.18;
export const SHARK_KILL_RADIUS = 1.3;
// Patrol orbit radius — pushed further out in v1.2 (0.55 → 0.70) so the
// safety buffer between the orbit and the island is bigger. The player can
// see fins from afar but they don't crowd the playfield.
export const SHARK_ORBIT_R = PLAYFIELD * 0.70;

// Camera — same downward tilt as Penguin Rescue but pulled in further for the
// smaller playfield (PR was 30, we're 24). Zoom can lift slightly as the
// player gains height so the whole island stays visible.
export const CAMERA_POS_BASE: [number, number, number] = [0, 16, 11];
export const CAMERA_FOV = 50;

// Scoring: score = floor(time) + (stackHeightUnderPlayer * 10).
export const HEIGHT_BONUS = 10;

// Colors
export const COLORS = {
  sand:       '#e6cf9c',
  sandShadow: '#c8ad75',
  sandWet:    '#7a8aa0',     // tile that is currently submerged (water > top)
  // Stack-layer palette by height (h-1 = layer index since base is sand)
  layer1:     '#d6a86b',     // sandstone — 1 layer above ground
  layer2:     '#8a8278',     // weathered stone
  layer3:     '#56504a',     // dark granite
  layerHigh:  '#3a352f',     // anything deeper
  rock:       '#8a8278',     // legacy alias
  rockDark:   '#56504a',     // legacy alias
  // Water + foam
  water:      '#1d4564',
  waterDeep:  '#0b2438',
  waterFoam:  '#cfe6f3',
  foamLine:   '#e8f3fb',     // breaking-waves line at island edge
  // Player tile halo
  playerHalo: '#ffe17a',
  // Items / actors
  plank:      '#a86a3a',
  plankDark:  '#7a4823',
  boulder:    '#6e6660',
  boulderShine: '#9f978f',
  paddle:     '#d7b977',
  paddleBlade: '#8c5e34',
  shark:      '#3a4a55',
  sharkBelly: '#bcc6cd',
  sharkWake:  '#cfe6f3',
  sailorJacket: '#ff8b3a',
  sailorJacketDark: '#c25e1c',
  sailorPants: '#21314a',
  sailorSkin: '#f0c9a3',
};

// How deep below WATER_BASE_Y a fully-sunk drowned tile rests.
export const TILE_SINK_DEPTH = 1.2;

// Bird silhouettes count (ambient)
export const BIRD_COUNT = 5;
