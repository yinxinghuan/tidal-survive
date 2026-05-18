import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { CAMERA_POS_BASE } from '../constants';
import type { GameRef } from '../hooks/useGameLoop';

/**
 * Screen-space pellet ("+1 PICK", "+10", etc.) layer. We poll the state ref
 * every 70ms, project active pellets from world → screen, and render them as
 * absolutely-positioned <div>s that animate via CSS.
 *
 * We project manually instead of using Drei's <Html> because we want a single
 * top-level DOM layer (no per-pellet 3D group), which keeps the cost down and
 * makes it trivial to tint pellets by `kind`.
 */
export function Pellets({ stateRef }: { stateRef: React.MutableRefObject<GameRef> }) {
  const [items, setItems] = useState<{ id: number; kind: string; text: string; x: number; y: number; age: number }[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = stateRef.current;
      const out: typeof items = [];
      // Cheap top-down approximation of the camera projection. The actual
      // camera follows the player; we use the same offset to derive screen
      // coordinates relative to the player's tile.
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      // World→screen factor: at camera distance the visible width spans
      // about 18-22 world units. Empirically ~0.06 of viewport width per
      // world unit on horizontal, ~0.075 vertical (steeper downward tilt).
      const sx = w * 0.062;
      const sy = h * 0.075;
      for (const p of d.pellets) {
        const age = d.time - p.startTime;
        if (age < 0 || age > 1.1) continue;
        // Player at center of screen → so projection is relative
        const relX = p.worldX - d.playerPos.x;
        const relZ = p.worldZ - d.playerPos.z;
        const screenX = cx + relX * sx;
        const screenY = cy + relZ * sy - (p.worldY - d.playerPos.y) * sy * 1.4;
        out.push({ id: p.id, kind: p.kind, text: p.text, x: screenX, y: screenY, age });
      }
      setItems(out);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [stateRef]);

  // suppress unused-var warning on CAMERA_POS_BASE if not used
  void CAMERA_POS_BASE; void THREE;

  return (
    <div className="ts__pellets">
      {items.map(p => (
        <div
          key={p.id}
          className={`ts__pellet ts__pellet--${p.kind}`}
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            // Drive the keyframe animation timeline by `age` so React state can
            // mount the element mid-animation without resetting it.
            animationDelay: `${-p.age}s`,
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
}
