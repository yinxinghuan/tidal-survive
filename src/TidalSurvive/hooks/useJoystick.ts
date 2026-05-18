import { useEffect, useRef, useState } from 'react';
import type { Stick } from '../types';

const RADIUS = 60; // half of the visible ring (120px ring → 60px max stick)
// A press counts as a "tap" (vs a drag) when it stays within this many pixels
// for its entire lifetime. Tap fires `onTap` on release. Drag does not.
const TAP_MAX_TRAVEL = 10;

export function useJoystick(enabled: boolean, onTap?: () => void) {
  const stickRef = useRef<Stick>({ active: false, x: 0, y: 0 });
  const [view, setView] = useState({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const maxTravel = useRef(0);
  // Latest callback in a ref so we don't have to rebind the listeners.
  const tapRef = useRef<typeof onTap>(onTap);
  tapRef.current = onTap;

  useEffect(() => {
    if (!enabled) {
      pointerId.current = null;
      stickRef.current.active = false;
      stickRef.current.x = 0;
      stickRef.current.y = 0;
      setView(v => ({ ...v, active: false }));
      return;
    }

    const onDown = (e: PointerEvent) => {
      if (pointerId.current !== null) return;
      pointerId.current = e.pointerId;
      origin.current = { x: e.clientX, y: e.clientY };
      maxTravel.current = 0;
      stickRef.current.active = true;
      stickRef.current.x = 0;
      stickRef.current.y = 0;
      setView({ active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    };
    const onMove = (e: PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxTravel.current) maxTravel.current = len;
      const clampLen = Math.min(len, RADIUS);
      const nx = len > 0 ? (dx / len) * clampLen : 0;
      const ny = len > 0 ? (dy / len) * clampLen : 0;
      const ux = nx / RADIUS;
      const uy = ny / RADIUS;
      stickRef.current.x = ux;
      stickRef.current.y = uy;
      setView({ active: true, ox: origin.current.x, oy: origin.current.y, x: nx, y: ny });
    };
    const onUp = (e: PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      const wasTap = maxTravel.current < TAP_MAX_TRAVEL;
      pointerId.current = null;
      stickRef.current.active = false;
      stickRef.current.x = 0;
      stickRef.current.y = 0;
      setView(v => ({ ...v, active: false }));
      if (wasTap && tapRef.current) tapRef.current();
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [enabled]);

  return { stickRef, view };
}
