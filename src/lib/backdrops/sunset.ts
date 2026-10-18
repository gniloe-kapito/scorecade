/* «Закат»: тёплое небо (сверху сиренево-розовое, ниже персиковое, у
 * горизонта золотистое), низкое солнце со свечением и мягким диском.
 * Плывущие облака в три слоя глубины: дальние маленькие и бледные
 * плывут медленно, ближние большие, плотные и быстрее; дальние —
 * позади солнца, ближние — перед ним. Облако рисуется ОДИН раз на
 * спрайт: десятки налезающих клубков по «куполу» + плоское основание
 * (destination-out) + раскраска вертикальным градиентом (source-atop);
 * перья — растянутые по горизонтали клубки. Перенесено из референса
 * без изменения алгоритма. */

import { clamp, rng, sprite, TAU, type Renderer, type RendererFactory } from "./utils";

type CloudKind = "cloud" | "streak";

/** Спрайт облака: маска из клубков по куполу, плоский низ, раскраска. */
function cloudSprite(wid: number, hei: number, seed: number, kind: CloudKind) {
  const R = rng(seed);
  return sprite(wid, hei, (g) => {
    const m = sprite(wid, hei, (q) => {
      const N = kind === "streak" ? 26 : 34;
      for (let i = 0; i < N; i++) {
        const u = R();
        const dome = Math.pow(Math.sin(Math.PI * clamp(u, 0.02, 0.98)), 0.75);
        if (kind === "streak") {
          const x = wid * (0.06 + 0.88 * u);
          const y = hei * (0.5 + (R() - 0.5) * 0.18);
          const rx = wid * (0.05 + 0.08 * R());
          const ry = hei * (0.16 + 0.14 * R());
          q.save();
          q.translate(x, y);
          q.scale(1, ry / rx);
          const gr = q.createRadialGradient(0, 0, 0, 0, 0, rx);
          gr.addColorStop(0, "rgba(255,255,255,.85)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          q.fillStyle = gr;
          q.beginPath();
          q.arc(0, 0, rx, 0, TAU);
          q.fill();
          q.restore();
        } else {
          const x = wid * (0.08 + 0.84 * u);
          const r = hei * (0.1 + 0.3 * dome * R() + 0.05 * R());
          const y = hei * 0.8 - r * (0.45 + 0.55 * R()) - hei * 0.3 * dome * R();
          const gr = q.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, "rgba(255,255,255,.95)");
          gr.addColorStop(0.55, "rgba(255,255,255,.55)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          q.fillStyle = gr;
          q.beginPath();
          q.arc(x, y, r, 0, TAU);
          q.fill();
        }
      }
      if (kind !== "streak") {
        // Плоское основание: стираем нижнюю часть маски.
        q.globalCompositeOperation = "destination-out";
        const f = q.createLinearGradient(0, hei * 0.72, 0, hei * 0.9);
        f.addColorStop(0, "rgba(0,0,0,0)");
        f.addColorStop(1, "rgba(0,0,0,1)");
        q.fillStyle = f;
        q.fillRect(0, 0, wid, hei);
      }
    });
    g.drawImage(m, 0, 0);
    g.globalCompositeOperation = "source-atop";
    const c = g.createLinearGradient(0, 0, 0, hei);
    if (kind === "streak") {
      c.addColorStop(0, "rgb(255,226,186)");
      c.addColorStop(1, "rgb(240,170,140)");
    } else {
      c.addColorStop(0, "rgb(255,240,214)");
      c.addColorStop(0.45, "rgb(250,196,164)");
      c.addColorStop(0.8, "rgb(222,138,140)");
      c.addColorStop(1, "rgb(190,112,134)");
    }
    g.fillStyle = c;
    g.fillRect(0, 0, wid, hei);
    if (kind !== "streak") {
      // Мягкий светлый блик справа вверху.
      const rl = g.createRadialGradient(wid * 0.7, hei * 0.3, 0, wid * 0.7, hei * 0.3, wid * 0.45);
      rl.addColorStop(0, "rgba(255,248,226,.7)");
      rl.addColorStop(1, "rgba(255,248,226,0)");
      g.fillStyle = rl;
      g.fillRect(0, 0, wid, hei);
    }
  });
}

interface Cloud {
  img: HTMLCanvasElement;
  y: number;
  x0: number;
  v: number; // px/сек
  a: number;
  w: number;
  h: number;
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let C: Cloud[] = [];
  const R = rng(61);

  return {
    resize(w, h) {
      W = w;
      H = h;
      const sc = clamp(w / 1000, 0.6, 1.6);
      C = [];
      const mk = (
        n: number,
        wid: number,
        hei: number,
        y0: number,
        y1: number,
        v: number,
        a: number,
        kind: CloudKind,
        seed: number,
      ) => {
        for (let i = 0; i < n; i++) {
          C.push({
            img: cloudSprite(Math.round(wid * sc), Math.round(hei * sc), seed + i * 7, kind),
            y: h * (y0 + (y1 - y0) * (n > 1 ? i / (n - 1) : 0.5)) + (R() - 0.5) * h * 0.03,
            x0: R() * (w + wid * sc),
            v,
            a,
            w: wid * sc,
            h: hei * sc,
          });
        }
      };
      mk(4, 380, 80, 0.5, 0.64, 3, 0.5, "cloud", 100);
      mk(3, 300, 34, 0.58, 0.66, 5, 0.5, "streak", 200);
      mk(3, 620, 130, 0.28, 0.48, 7, 0.72, "cloud", 300);
      mk(2, 860, 175, 0.06, 0.26, 11, 0.88, "cloud", 400);
    },
    frame(g, t) {
      const hy = H * 0.7;
      const sky = g.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, "rgba(206,150,176,.5)");
      sky.addColorStop(0.5, "rgba(246,184,156,.5)");
      sky.addColorStop(1, "rgba(255,214,150,.62)");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, hy);
      const gd = g.createLinearGradient(0, hy, 0, H);
      gd.addColorStop(0, "rgba(255,206,150,.55)");
      gd.addColorStop(1, "rgba(240,170,150,.18)");
      g.fillStyle = gd;
      g.fillRect(0, hy, W, H - hy);
      const drawC = (far: boolean) => {
        for (const c of C) {
          if ((c.v <= 5) !== far) continue;
          const span = W + c.w;
          const x = ((c.x0 + t * c.v) % span) - c.w;
          g.globalAlpha = c.a;
          g.drawImage(c.img, x, c.y);
        }
        g.globalAlpha = 1;
      };
      drawC(true); // дальние — за солнцем
      const sx = W * 0.68;
      const sy = hy - H * 0.1 + Math.sin(t * 0.05) * H * 0.02;
      const sr = H * 0.085;
      const bl = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
      bl.addColorStop(0, "rgba(255,236,176,.85)");
      bl.addColorStop(0.18, "rgba(255,205,140,.45)");
      bl.addColorStop(1, "rgba(255,180,120,0)");
      g.fillStyle = bl;
      g.fillRect(0, 0, W, H);
      const sd = g.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
      sd.addColorStop(0, "rgba(255,250,228,1)");
      sd.addColorStop(0.85, "rgba(255,236,184,.98)");
      sd.addColorStop(1, "rgba(255,220,160,0)");
      g.fillStyle = sd;
      g.beginPath();
      g.arc(sx, sy, sr * 1.05, 0, TAU);
      g.fill();
      drawC(false); // ближние — перед солнцем
      const hz = g.createLinearGradient(0, hy - H * 0.05, 0, hy + H * 0.06);
      hz.addColorStop(0, "rgba(255,220,160,0)");
      hz.addColorStop(0.5, "rgba(255,214,150,.5)");
      hz.addColorStop(1, "rgba(255,214,150,0)");
      g.fillStyle = hz;
      g.fillRect(0, hy - H * 0.05, W, H * 0.11);
    },
  };
};
