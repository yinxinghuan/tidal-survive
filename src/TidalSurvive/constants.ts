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

// v1.9: shallow water padding around the island. Player walking off the
// grid but within this padding is "in shallow water" — visual splash and
// foam effects still fire, but the shark countdown does NOT accumulate.
// The threat is reserved for actually swimming far from shore. World units.
export const SHALLOW_PADDING = TILE_SIZE; // 1 tile wide ring beyond the grid

// Player
export const PLAYER_SPEED_NORMAL = 8.0;
export const PLAYER_SPEED_CARRYING_HEAVY = 4.5; // boulder
export const PLAYER_SPEED_CARRYING_LIGHT = 7.2; // plank / paddle
export const PLAYER_RADIUS = 0.5;
// v1.8: 3 → 4s. Core gameplay loop is "wade into water to grab building
// materials". Player needs a real window in water to grab+return without
// being murdered.
export const SHARK_DELAY_IN_WATER = 4.0;
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
// v1.9: 1.5 → 1.8 — more forgiving reach so the player can grab items just
// past the tile edge without pixel-perfect positioning.
export const ITEM_PICKUP_RADIUS = 1.8;

// v1.5: items drift in from the water rather than dropping from the sky.
// Spawn distance OUTSIDE the playfield in world units (so they're visible at
// spawn but a beat away from being grabbed).
export const ITEM_DRIFT_SPAWN_OFFSET = 4.5;
// World-units / second drift speed toward the target tile edge.
export const ITEM_DRIFT_SPEED = 2.0;
// v1.7: items now park IN THE WATER, ~1.7 units past the tile edge along the
// approach line. PARK_DIST is the radial distance from the target tile
// CENTER at which the item freezes. With TILE_SIZE/2 = 1.5 (tile half-width)
// and PARK_DIST = 3.2, the item rests 1.7 units past the tile edge in open
// water. The player has to walk to the very edge (or briefly wade) to be
// within ITEM_PICKUP_RADIUS = 1.5 of it. That's the "reach into the water"
// feel the spec calls for.
export const ITEM_DRIFT_PARK_DIST = 3.2;
// Vertical offset above the water surface for floating items.
export const ITEM_FLOAT_Y_OFFSET = 0.18;

// Sharks
export const SHARK_COUNT = 3;
export const SHARK_PATROL_SPEED = 2.6;
// Lunge speed used when the player has been in water past SHARK_DELAY.
// v1.8: 4 → 3 — sharks are now slow-moving threats, not instant death.
// Player should fear lingering, not fear stepping in for 1-2s.
export const SHARK_LUNGE_SPEED = 3;
export const SHARK_FIN_HEIGHT = 0.18;
export const SHARK_KILL_RADIUS = 1.3;
// Patrol orbit radius — v1.8: 0.70 → 0.80 of PLAYFIELD. Sharks stay even
// further from the island so the lunge starts from further away, buying
// more reaction time when the countdown expires.
export const SHARK_ORBIT_R = PLAYFIELD * 0.80;

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
