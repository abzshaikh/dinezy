import { useEffect, useState } from 'react';

/**
 * Animates a number from 0 up to `target` over `durationMs`, easing out.
 * Used by StatCard so dashboard/report figures count up on mount instead
 * of just appearing — part of the "Neon Service" design system's animation
 * language (see PHASE_17_REPORT.md). Respects prefers-reduced-motion by
 * jumping straight to the final value.
 */
export function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !Number.isFinite(target)) {
      setValue(target);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const from = 0;
    const to = target;

    function step(ts: number) {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
