// src/hooks/useCountUp.ts
// Count-up animation hook: đếm từ 0 → target khi component mount

import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  target: number;
  duration?: number;   // ms
  enabled?: boolean;   // tắt khi reduced-motion
  easing?: (t: number) => number;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useCountUp({
  target,
  duration = 1200,
  enabled = true,
  easing = easeOutExpo,
}: UseCountUpOptions): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const rafRef  = useRef<number>(0);
  const startTs = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    let cancelled = false;
    startTs.current = 0;

    function tick(ts: number) {
      if (cancelled) return;
      if (!startTs.current) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const progress = Math.min(elapsed / duration, 1);
      setValue(target * easing(progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled, easing]);

  return value;
}
