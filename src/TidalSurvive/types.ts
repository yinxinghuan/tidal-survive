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
  // World-space position. y animates from spawn height down to landing y.
  position: THREE.Vector3;
  // Grid coords of the landing tile (set on spawn).
  col: number;
  row: number;
  // Vertical velocity (drop-in physics).
  vy: number;
  // Once landed (touches stack top), held position is locked here.
  landed: boolean;
  landY: number;
  // Tiny rotation phase for "barely floating" idle bob.
  phase: number;
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
