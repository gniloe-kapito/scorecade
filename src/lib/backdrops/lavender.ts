/* «Лаванда»: шесть полупрозрачных волнистых лент (как складки шёлка),
 * каждая со светлым бликом вдоль верхней кромки, разной толщины и
 * фазы, плывут медленно и независимо. Верхняя кромка — сумма двух
 * синусоид, толщина «дышит»; среди лент мерцают крошечные
 * четырёхконечные искры. Перенесено из референса без изменения
 * алгоритма. */

import { rgba, rng, TAU, type Renderer, type RendererFactory } from "./utils";

interface Ribbon {
  /** Доля высоты экрана (ось ленты). */
  y: number;
  /** Цвет. */
  c: readonly [number, number, number];
  /** Базовая альфа. */
  a: number;
  /** Базовая толщина. */
  th: number;
  /** Частоты движения кромки. */
  s1: number;
  s2: number;
}

const RIBBONS: ReadonlyArray<Ribbon> = [
  { y: 0.12, c: [160, 140, 214], a: 0.3, th: 48, s1: 0.07, s2: 0.11 },
  { y: 0.22, c: [132, 112, 196], a: 0.34, th: 56, s1: 0.08, s2: 0.13 },
  { y: 0.34, c: [188, 160, 226], a: 0.3, th: 52, s1: 0.065, s2: 0.1 },
  { y: 0.46, c: [120, 104, 190], a: 0.3, th: 60, s1: 0.075, s2: 0.12 },
  { y: 0.58, c: [170, 144, 220], a: 0.3, th: 54, s1: 0.06, s2: 0.09 },
  { y: 0.72, c: [140, 120, 204], a: 0.34, th: 50, s1: 0.07, s2: 0.1 },
];

interface Spark {
  x: number;
  y: number;
  ph: number;
  f: number;
  s: number;
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  const R = rng(81);
  let sp: Spark[] = [];

  return {
    resize(w, h) {
      W = w;
      H = h;
      sp = Array.from({ length: Math.round((w * h) / 14000) }, () => ({
        x: R() * w,
        y: R() * h,
        ph: R() * TAU,
        f: 0.5 + R() * 1.6,
        s: 3 + R() * 5,
      }));
    },
    frame(g, t) {
      RIBBONS.forEach((r, i) => {
        const yc = H * r.y;
        const A1 = H * 0.07;
        const A2 = H * 0.03;
        const pts: Array<[number, number, number]> = [];
        for (let x = -20; x <= W + 20; x += 14) {
          const top =
            yc +
            Math.sin(x * 0.0042 + t * r.s1 + i * 1.3) * A1 +
            Math.sin(x * 0.0095 - t * r.s2 + i * 2.1) * A2;
          const thick = r.th + Math.sin(x * 0.005 + t * 0.18 + i) * r.th * 0.55;
          pts.push([x, top, thick]);
        }
        const gr = g.createLinearGradient(0, yc - H * 0.12, 0, yc + H * 0.2);
        gr.addColorStop(0, rgba(r.c[0], r.c[1], r.c[2], r.a));
        gr.addColorStop(0.5, rgba(r.c[0], r.c[1], r.c[2], r.a * 0.6));
        gr.addColorStop(1, rgba(r.c[0], r.c[1], r.c[2], 0));
        g.fillStyle = gr;
        g.beginPath();
        pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        for (let k = pts.length - 1; k >= 0; k--) {
          g.lineTo(pts[k][0], pts[k][1] + pts[k][2] * 2.2);
        }
        g.closePath();
        g.fill();
        // Блик вдоль верхней кромки.
        g.strokeStyle = rgba(r.c[0] + 40, r.c[1] + 45, r.c[2] + 25, 0.62);
        g.lineWidth = 1.6;
        g.beginPath();
        pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
      });
      // Четырёхконечные искры.
      for (const s of sp) {
        const tw = Math.pow(0.5 + 0.5 * Math.sin(t * s.f + s.ph), 3);
        if (tw < 0.04) continue;
        const r = s.s * (0.4 + 0.6 * tw);
        g.globalAlpha = 0.75 * tw;
        g.fillStyle = "rgb(130,108,200)";
        g.beginPath();
        g.moveTo(s.x, s.y - r);
        g.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
        g.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
        g.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
        g.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
        g.fill();
      }
      g.globalAlpha = 1;
    },
  };
};
