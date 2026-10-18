/* «Угли»: тёмная комната с жаром. Внизу по центру тёплое свечение
 * мерцает неровно (сумма синусов — как огонь), вдоль нижнего края
 * пять горячих точек мерцают по-разному. Искры всплывают снизу вверх
 * (свечение-спрайты в режиме lighter), внизу жёлто-белые, выше
 * оранжевые, у верха гаснут; изредка проплывают крупные тусклые
 * угольки. Перенесено из референса без изменения алгоритма. */

import { clamp, glowSprite, rgba, rng, TAU, type Renderer, type RendererFactory } from "./utils";

interface Spark {
  x: number;
  y: number;
  vy: number;
  s: number;
  ph: number;
  wob: number;
  fr: number;
  big: boolean;
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let P: Spark[] = [];
  const R = rng(11);

  const hot = glowSprite(64, [
    [0, "rgba(255,240,200,1)"],
    [0.25, "rgba(255,190,100,.85)"],
    [0.6, "rgba(240,110,40,.25)"],
    [1, "rgba(200,60,20,0)"],
  ]);
  const cool = glowSprite(64, [
    [0, "rgba(255,170,90,1)"],
    [0.3, "rgba(235,100,45,.6)"],
    [1, "rgba(160,40,15,0)"],
  ]);

  const spawn = (p: Spark, init: boolean) => {
    p.x = R() * W;
    p.y = init ? R() * H : H + 12;
    p.vy = 18 + R() * 60;
    p.s = 0.5 + R() * 1.6;
    p.ph = R() * TAU;
    p.wob = 6 + R() * 26;
    p.fr = 0.6 + R() * 1.6;
    p.big = R() < 0.12;
    if (p.big) {
      p.s *= 2.2;
      p.vy *= 0.6;
    }
  };

  return {
    resize(w, h) {
      W = w;
      H = h;
      const n = clamp(Math.round(w / 11), 28, 110);
      P = [];
      for (let i = 0; i < n; i++) {
        const p: Spark = {
          x: 0, y: 0, vy: 0, s: 0, ph: 0, wob: 0, fr: 0, big: false,
        };
        spawn(p, true);
        P.push(p);
      }
    },
    frame(g, t, dt) {
      g.globalCompositeOperation = "lighter";
      // Неровное «пламенное» мерцание жара.
      const fl =
        0.62 +
        0.18 * Math.sin(t * 1.7) +
        0.1 * Math.sin(t * 4.3 + 1) +
        0.06 * Math.sin(t * 9.1 + 2);
      g.save();
      g.translate(W / 2, H * 1.04);
      g.scale(1, 0.46);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.75);
      gr.addColorStop(0, rgba(255, 150, 70, 0.85 * fl));
      gr.addColorStop(0.35, rgba(235, 100, 45, 0.4 * fl));
      gr.addColorStop(1, "rgba(150,40,15,0)");
      g.fillStyle = gr;
      g.fillRect(-W, -W, W * 2, W * 2);
      g.restore();
      // Пять горячих точек вдоль нижнего края.
      for (let i = 0; i < 5; i++) {
        const x = W * (0.1 + 0.2 * i) + Math.sin(t * 0.3 + i) * 30;
        const f = 0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.37) + i * 2);
        const r = W * 0.12;
        const q = g.createRadialGradient(x, H, 0, x, H, r);
        q.addColorStop(0, rgba(255, 170, 90, 0.38 * f));
        q.addColorStop(1, "rgba(200,70,20,0)");
        g.fillStyle = q;
        g.fillRect(x - r, H - r, r * 2, r);
      }
      // Искры.
      for (const p of P) {
        p.y -= p.vy * dt;
        p.x += Math.sin(t * p.fr + p.ph) * p.wob * dt;
        if (p.y < -20) spawn(p, false);
        const k = 1 - p.y / H;
        const a = clamp(1 - k * 1.05, 0, 1) * (0.65 + 0.35 * Math.sin(t * p.fr * 4 + p.ph));
        const sz = p.s * (p.big ? 16 : 9) * (1.1 - 0.4 * k);
        g.globalAlpha = clamp(a, 0, 1) * (p.big ? 0.55 : 0.95);
        g.drawImage(k < 0.45 ? hot : cool, p.x - sz, p.y - sz, sz * 2, sz * 2);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    },
  };
};
