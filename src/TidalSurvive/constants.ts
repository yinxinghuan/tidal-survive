// Tidal Survive — grid island slowly drowning under rising tide.
// 8x8 height grid, water rises every TIDE_INTERVAL seconds.

export const GRID = 8;                  // 8 x 8 grid
export const TILE_SIZE = 3;             // world units per tile
export const PLAYFIELD = GRID * TILE_SIZE; // 24
export const TILE_THICKNESS = 0.45;     // visual block thickness per stack unit

// The "ground" — top of a bare (stack=0) tile, where the player stands at start.
export const GROUND_Y = 0;

// Tide
export const TIDE_INTERVAL = 5;         // seconds between water level +1
export const TIDE_RISE_DURATION = 0.8;  // water lerps in over this long when level changes
// Water y at level 0. Set below GROUND_Y so the start is safe AND the water
// plane is visible around/between tiles. With WATER_Y_PER_LEVEL =
// TILE_THICKNESS (0.45), level 1 leaves a small dry gap on a bare tile
// (-0.15 < 0), and level 2 floods the bare tile so the player must have
// stacked at least once by ~10s.
export const WATER_BASE_Y = -0.6;
export const WATER_Y_PER_LEVEL = TILE_THICKNESS;
// Drown threshold: a tile is "drowned" once water.y > stackTop - margin.
export const DROWN_MARGIN = 0.08;

// Player
export const PLAYER_SPEED_NORMAL = 8.0;
export const PLAYER_SPEED_CARRYING_HEAVY = 4.5; // boulder
export const PLAYER_SPEED_CARRYING_LIGHT = 7.2; // plank / paddle
export const PLAYER_RADIUS = 0.5;
// 2 seconds in water → shark bites
export const SHARK_DELAY_IN_WATER = 2.0;
// Grace at game start
export const GRACE_PERIOD = 1.5;

// Items
export const ITEM_SPAWN_INTERVAL_MIN = 3;
export const ITEM_SPAWN_INTERVAL_MAX = 5;
export const ITEM_MAX_ACTIVE = 6;
// Spawn weights — sum doesn't have to be 1.
export const ITEM_WEIGHTS = { plank: 6, boulder: 3, paddle: 1 };
export const PADDLE_TIDE_BUFFER = 5.0; // seconds added to nextTide on pickup
export const ITEM_PICKUP_RADIUS = 1.1;

// Item drop visual — items fall onto the highest tile under spawn col/row.
export const ITEM_DROP_HEIGHT = 12;

// Sharks
export const SHARK_COUNT = 3;
export const SHARK_PATROL_SPEED = 2.6;
export const SHARK_LUNGE_SPEED = 9;     // when player has been in water > SHARK_DELAY
export const SHARK_FIN_HEIGHT = 0.18;   // how high above water the fin pokes
export const SHARK_KILL_RADIUS = 1.3;
// Patrol orbit radius — kept just outside the island so the fins are always
// visible in the camera frame.
export const SHARK_ORBIT_R = PLAYFIELD * 0.55;

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
  sandWet:    '#b89867',
  rock:       '#8a8278',
  rockDark:   '#56504a',
  water:      '#1d4564',
  waterDeep:  '#0b2438',
  waterFoam:  '#cfe6f3',
  plank:      '#a86a3a',
  plankDark:  '#7a4823',
  boulder:    '#6e6660',
  boulderShine: '#9f978f',
  paddle:     '#d7b977',
  paddleBlade: '#8c5e34',
  shark:      '#3a4a55',
  sharkBelly: '#bcc6cd',
  sailorJacket: '#ff8b3a',
  sailorJacketDark: '#c25e1c',
  sailorPants: '#21314a',
  sailorSkin: '#f0c9a3',
};

// Bird silhouettes count (ambient)
export const BIRD_COUNT = 5;
