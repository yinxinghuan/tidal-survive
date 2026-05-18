import * as THREE from 'three';

export type Phase = 'splash' | 'playing' | 'gameover';

export interface Stick {
  active: boolean;
  x: number; // -1..1
  y: number; // -1..1
}

export type ItemKind = 'plank' | 'boulder' | 'paddle';

export interface Item {
  id: number;
  kind: ItemKind;
  // World-space position. y tracks the water surface (item floats).
  position: THREE.Vector3;
  // Grid coords of the target tile the item drifts toward.
  col: number;
  row: number;
  // Drift mode — true while the item is moving toward its target tile.
  // Once false, the item is "parked" at the tile edge and bobs in place,
  // available for pickup.
  drifting: boolean;
  // Where the item is heading in world space (x,z of the target tile edge).
  targetX: number;
  targetZ: number;
  // Random phase for idle bob.
  phase: number;
  // Next game-time at which this parked item should emit a small water
  // ripple ring. Throttles the surface effect so floating items visibly
  // displace water without spamming the renderer.
  nextRippleAt: number;
}

export interface Shark {
  id: number;
  // World position (y stays just under water surface)
  position: THREE.Vector3;
  rotation: number;
  // Patrol orbit center + angle when no target
  orbit: { cx: number; cz: number; r: number; phase: number };
  // Whether this shark is currently lunging at the player
  lunging: boolean;
}

export interface Bird {
  id: number;
  angle: number;
  radius: number;
  height: number;
  speed: number;
}

// Floating "+1 PICK" / "+10 HEIGHT" pellet (screen-space, rendered in HUD)
export interface Pellet {
  id: number;
  kind: 'pick' | 'height' | 'paddle';
  text: string;
  // World position to project to screen
  worldX: number; worldZ: number; worldY: number;
  startTime: number;
}

// Expanding dust/water ring at a tile center
export interface DustRing {
  id: number;
  worldX: number; worldZ: number; worldY: number;
  startTime: number;
  kind: 'dust' | 'splash' | 'tide';
}

// Active tutorial step
export type TutorialStep = 'move' | 'pickup' | 'drop' | 'tide' | 'done';

// READY/GO start ritual phase
export type StartRitual = 'idle' | 'ready' | 'go' | 'done';
