/* «Космос»: звёзды с параллаксом, метеоры, туманность.
 *
 * Порт 1-в-1 из проверенного референса (backdrops-demo.html, R_.cosmos)
 * по просьбе пользователя: три слоя звёзд — точки, мягкие глоры и
 * редкие крупные с крестообразными бликами-«искрами» (появляются в
 * момент максимального мерцания), тёплые/холодные оттенки звёзд как
 * в референсе, три радиальные туманности дрейфуют по синусоидам.
 * Раз в 7–18 секунд пролетает метеор со светящимся хвостом. */

import { clamp, glowSprite, rgba, rng, TAU, type Renderer, type RendererFactory } from "./utils";

interface Star {
  x: number;
  y: number;
  ph: number;
  f: number;
  c: readonly [number, number, number];
}

interface StarLayer {
  v: number; // скорость дрейфа, px/сек
  a: number; // базовая альфа
  s: number; // масштаб свечения
  st: Star[];
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let L: StarLayer[] = [];
  let R = rng(31);
  let meteor: Meteor | null = null;
  let next = 4;
  const star = glowSprite(32, [
    [0, "rgba(255,255,255,1)"],
    [0.2, "rgba(220,225,255,.8)"],
    [1, "rgba(180,190,255,0)"],
  ]);

  return {
    resize(w, h) {
      W = w;
      H = h;
      const A = (w * h) / 90000;
      /* [число, масштаб, скорость, альфа] — как в референсе. */
      const defs: ReadonlyArray<readonly [number, number, number, number]> = [
        [Math.round(130 * A), 0.5, 3, 0.6],
        [Math.round(30 * A), 1, 6, 0.85],
        [Math.round(9 * A), 1.8, 11, 1],
      ];
      L = defs.map(([n, s, v, a]) => ({
        v,
        a,
        s,
        st: Array.from({ length: Math.max(n, 10) }, () => {
          const r1 = R();
          const r2 = R();
          const c: readonly [number, number, number] =
            r1 < 0.2
              ? [255, 214, 170]
              : r2 < 0.4
                ? [170, 200, 255]
                : [235, 235, 255];
          return { x: R() * w, y: R() * h, ph: R() * TAU, f: 0.6 + R() * 2.4, c };
        }),
      }));
    },

    frame(g, t, dt) {
      /* Туманности: три радиальных облака, медленный дрейф. */
      const neb: ReadonlyArray<
        readonly [number, number, number, readonly [number, number, number], number, number]
      > = [
        [0.22, 0.3, 0.55, [120, 80, 200], 0.2, 0.04],
        [0.78, 0.7, 0.6, [70, 110, 220], 0.17, 0.05],
        [0.55, 0.15, 0.4, [200, 90, 170], 0.12, 0.03],
      ];
      for (const [x, y, r, c, a, sp] of neb) {
        const cx = W * (x + Math.sin(t * sp + x * 9) * 0.06);
        const cy = H * (y + Math.cos(t * sp * 1.2 + y * 7) * 0.05);
        const rr = W * r;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
        gr.addColorStop(0, rgba(c[0], c[1], c[2], a));
        gr.addColorStop(1, rgba(c[0], c[1], c[2], 0));
        g.fillStyle = gr;
        g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }

      g.globalCompositeOperation = "lighter";
      for (const l of L) {
        for (const s of l.st) {
          if (dt > 0) {
            s.x -= l.v * dt;
            if (s.x < -6) s.x = W + 6;
          }
          const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.ph);
          if (l.s < 0.8) {
            /* Мелкие — точки. */
            g.globalAlpha = l.a * (0.3 + 0.6 * tw);
            g.fillStyle = rgba(s.c[0], s.c[1], s.c[2], 1);
            g.fillRect(s.x, s.y, 1.4, 1.4);
            continue;
          }
          /* Средние и крупные — спрайт свечения. */
          const sz = (1 + l.s * 1.3) * (0.7 + 0.5 * tw);
          g.globalAlpha = l.a * (0.4 + 0.6 * tw);
          g.drawImage(star, s.x - sz * 1.5, s.y - sz * 1.5, sz * 3, sz * 3);
          /* Крупные в момент яркого мерцания — крестообразная искра. */
          if (l.s > 1.5 && tw > 0.8) {
            g.globalAlpha = 0.4 * l.a;
            g.fillStyle = "#fff";
            g.fillRect(s.x - sz * 2.6, s.y - 0.5, sz * 5.2, 1);
            g.fillRect(s.x - 0.5, s.y - sz * 2.6, 1, sz * 5.2);
          }
        }
      }
      g.globalAlpha = 1;

      /* Метеор: раз в 7–18 секунд. */
      if (dt > 0) {
        next -= dt;
        if (!meteor && next <= 0) {
          const a = 0.45 + R() * 0.35;
          meteor = {
            x: W * (0.3 + R() * 0.7),
            y: -10 + R() * H * 0.3,
            vx: -Math.cos(a) * 620,
            vy: Math.sin(a) * 620,
            life: 0,
            max: 0.9 + R() * 0.4,
          };
          next = 7 + R() * 11;
        }
      }
      if (meteor) {
        const m = meteor;
        if (dt > 0) {
          m.life += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
        }
        const k = m.life / m.max;
        const a = Math.sin(Math.PI * clamp(k, 0, 1));
        const len = 170;
        const tx = m.x - (m.vx / 620) * len;
        const ty = m.y - (m.vy / 620) * len;
        const gr = g.createLinearGradient(m.x, m.y, tx, ty);
        gr.addColorStop(0, rgba(255, 255, 255, 0.95 * a));
        gr.addColorStop(1, "rgba(160,180,255,0)");
        g.strokeStyle = gr;
        g.lineWidth = 2;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(m.x, m.y);
        g.lineTo(tx, ty);
        g.stroke();
        if (k >= 1) meteor = null;
      }
      g.globalCompositeOperation = "source-over";
    },
  };
};
