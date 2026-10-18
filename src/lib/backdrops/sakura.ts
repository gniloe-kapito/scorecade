/* «Сакура»: лепестки сакуры кружатся и падают по диагонали, на ветру,
 * в трёх слоях глубины (дальние мельче и бледнее, ближние крупнее и
 * ярче). Лепесток — две кривые Безье с выемкой на кончике, градиент
 * розовый, тонкая прожилка; кувырок — сужение по X. Внизу лёгкая
 * розовая дымка, ветер меняет силу периодически.
 * Перенесено из референса без изменения алгоритма. */

import { clamp, rgba, rng, TAU, type Renderer, type RendererFactory } from "./utils";

interface Petal {
  z: number; // слой глубины: 0 дальний … 2 ближний
  s: number; // размер
  x: number;
  y: number;
  vy: number;
  sw: number;
  fr: number;
  ph: number;
  rot: number;
  vr: number;
  fl: number; // фаза кувырка
  ff: number; // частота кувырка
  a: number; // альфа слоя
  tint: number;
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let P: Petal[] = [];
  const R = rng(21);

  const petal = (g: CanvasRenderingContext2D, s: number) => {
    g.beginPath();
    g.moveTo(0, -s);
    g.bezierCurveTo(s * 0.95, -s * 0.75, s * 0.85, s * 0.55, s * 0.06, s);
    g.lineTo(0, s * 0.82);
    g.lineTo(-s * 0.06, s);
    g.bezierCurveTo(-s * 0.85, s * 0.55, -s * 0.95, -s * 0.75, 0, -s);
    g.closePath();
  };

  const spawn = (p: Petal, init: boolean) => {
    const z = R();
    p.z = z < 0.35 ? 0 : z < 0.75 ? 1 : 2;
    const sc = [0.6, 1, 1.55][p.z];
    p.s = (11 + R() * 8) * sc;
    p.x = R() * (W + 200) - 100;
    p.y = init ? R() * H : -30 - R() * 80;
    p.vy = (22 + R() * 28) * [0.6, 0.9, 1.25][p.z];
    p.sw = 10 + R() * 28;
    p.fr = 0.5 + R() * 1.1;
    p.ph = R() * TAU;
    p.rot = R() * TAU;
    p.vr = (R() - 0.5) * 1.6;
    p.fl = R() * TAU;
    p.ff = 1.2 + R() * 2.2;
    p.a = [0.5, 0.72, 0.92][p.z];
    p.tint = R();
  };

  return {
    resize(w, h) {
      W = w;
      H = h;
      const n = clamp(Math.round(w / 17), 24, 70);
      P = [];
      for (let i = 0; i < n; i++) {
        const p: Petal = {
          z: 0, s: 0, x: 0, y: 0, vy: 0, sw: 0, fr: 0, ph: 0,
          rot: 0, vr: 0, fl: 0, ff: 0, a: 0, tint: 0,
        };
        spawn(p, true);
        P.push(p);
      }
      P.sort((a, b) => a.z - b.z);
    },
    frame(g, t, dt) {
      const hz = g.createLinearGradient(0, H * 0.55, 0, H);
      hz.addColorStop(0, "rgba(240,170,196,0)");
      hz.addColorStop(1, "rgba(240,170,196,.32)");
      g.fillStyle = hz;
      g.fillRect(0, H * 0.55, W, H * 0.45);
      const wind = Math.sin(t * 0.13) * 24 + Math.sin(t * 0.37 + 1) * 12 + 14;
      for (const p of P) {
        p.y += p.vy * dt;
        p.x += (wind * (0.5 + 0.25 * p.z) + Math.sin(t * p.fr + p.ph) * p.sw) * dt;
        p.rot += p.vr * dt;
        if (p.y > H + 30 || p.x > W + 120) {
          spawn(p, false);
          p.x = -60 + R() * (W * 0.6);
        }
        const flip = Math.cos(t * p.ff + p.fl);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(0.35 + 0.65 * Math.abs(flip), 1);
        const gr = g.createLinearGradient(0, -p.s, 0, p.s);
        gr.addColorStop(0, rgba(250, 214, 224, p.a));
        gr.addColorStop(
          0.6,
          rgba(238 + p.tint * 8, 160 + p.tint * 30, 186 + p.tint * 20, p.a),
        );
        gr.addColorStop(1, rgba(214, 120, 152, p.a));
        g.fillStyle = gr;
        petal(g, p.s);
        g.fill();
        g.strokeStyle = rgba(190, 100, 135, p.a * 0.35);
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(0, -p.s * 0.6);
        g.lineTo(0, p.s * 0.55);
        g.stroke();
        g.restore();
      }
    },
  };
};
