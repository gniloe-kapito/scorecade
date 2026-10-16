"use client";

import { useEffect, useState } from "react";

/** Анимированный счётчик: число «накручивается» от 0 до target.
 *  Учитывает prefers-reduced-motion (мгновенное значение). Все установки
 *  значения происходят в rAF-колбэках — без синхронного setState в эффекте. */
export function useCountUp(target: number, durationMs = 650): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !Number.isFinite(target) || target <= 0) {
      // Без анимации: значение выставляется в следующем кадре.
      raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — быстрый разгон, мягкое торможение
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
