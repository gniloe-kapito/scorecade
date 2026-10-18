/* Общие утилиты canvas-фонов живых тем.
 * Перенесено из проверенного референса (backdrops-demo.html) с
 * типизацией; алгоритмы и параметры не менялись.
 * Рендерер каждой темы реализует интерфейс Renderer:
 *   resize(w, h) — новые логические (CSS) размеры окна;
 *   frame(g, t, dt) — один кадр; t — секунды с начала, dt — секунды
 *   с прошлого кадра (0 — статичная отрисовка, движения и вспышек нет).
 * Холст прозрачный: базовый цвет фона живёт на <html>. Холст перед
 * кадром очищается компонентом ThemeCanvas (сам рендерер не чистит). */

export interface Renderer {
  resize(w: number, h: number): void;
  frame(g: CanvasRenderingContext2D, t: number, dt: number): void;
}
export type RendererFactory = () => Renderer;

export const TAU = Math.PI * 2;

/** Детерминированный ГПСЧ (mulberry32): фон одинаков при каждом запуске. */
export function rng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number) =>
  v < a ? a : v > b ? b : v;

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Гладкая интерполяция (smoothstep) на отрезке [a, b]. */
export const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

export const rgba = (r: number, g: number, b: number, a: number) =>
  `rgba(${r | 0},${g | 0},${b | 0},${a})`;

/** Оффскрин-холст, нарисованный один раз (спрайт). */
export function sprite(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  draw(g, w, h);
  return c;
}

/** Круглый радиальный спрайт свечения. */
export function glowSprite(
  size: number,
  stops: ReadonlyArray<readonly [number, string]>,
): HTMLCanvasElement {
  return sprite(size, size, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [pos, color] of stops) gr.addColorStop(pos, color);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}
