/* «Гроза»: косой дождь (12–18° от вертикали) в 2–3 слоя параллакса,
 * ветер качает угол, сверху ползут тёмные тучи, изредка бьёт
 * зигзагообразная молния с двойной вспышкой фона.
 * Перенесено из ThemeCanvas.tsx без изменения визуала; тайминги
 * переведены с performance.now() на параметр t (секунды). */

import type { Renderer, RendererFactory } from "./utils";

interface RainLayer {
  drops: { x: number; y: number; len: number }[];
  speed: number; // px/сек
  alpha: number;
  width: number;
  lenMin: number;
  lenMax: number;
}

interface Bolt {
  /** Точки ломаной [x, y]. */
  points: Array<[number, number]>;
  branches: Array<Array<[number, number]>>;
  /** Секунды жизни разряда (для затухания). */
  life: number;
}

const stormLayer = (
  count: number,
  speed: number,
  alpha: number,
  width: number,
  lenMin: number,
  lenMax: number,
  w: number,
  h: number,
): RainLayer => {
  const drops = Array.from({ length: count }, () => ({
    x: Math.random() * (w * 1.3) - w * 0.15,
    y: Math.random() * h,
    len: lenMin + Math.random() * (lenMax - lenMin),
  }));
  return { drops, speed, alpha, width, lenMin, lenMax };
};

const makeBolt = (w: number, h: number): Bolt => {
  // Зигзаг сверху вниз со случайным дрожанием по горизонтали.
  const startX = w * (0.15 + Math.random() * 0.7);
  const points: Array<[number, number]> = [[startX, -20]];
  let x = startX;
  const steps = 8 + ((Math.random() * 5) | 0);
  for (let i = 1; i <= steps; i++) {
    x += (Math.random() - 0.5) * w * 0.06;
    points.push([x, (i / steps) * (h * 0.85)]);
  }
  // 1–2 коротких ответвления от середины разряда.
  const branches: Array<Array<[number, number]>> = [];
  const branchCount = 1 + ((Math.random() * 2) | 0);
  for (let b = 0; b < branchCount; b++) {
    const from = points[2 + ((Math.random() * (points.length - 4)) | 0)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const branch: Array<[number, number]> = [from];
    let bx = from[0];
    let by = from[1];
    for (let i = 0; i < 3; i++) {
      bx += dir * (10 + Math.random() * 30);
      by += 24 + Math.random() * 40;
      branch.push([bx, by]);
    }
    branches.push(branch);
  }
  return { points, branches, life: 0 };
};

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let layers: RainLayer[] = [];
  let clouds: Array<{ x: number; y: number; r: number; drift: number }> = [];
  let bolt: Bolt | null = null;
  let nextBoltAt = 4 + Math.random() * 8; // сек t

  const spawn = () => {
    const { w, h } = { w: W, h: H };
    const mobile = w < 640;
    // Три слоя параллакса: дальний — медленный и короткий, передний —
    // быстрый и длинный. На телефоне капель меньше.
    layers = [
      stormLayer(
        Math.round((mobile ? 34 : 70) * (w / 1280) * 1.6),
        130, 0.1, 1, 10, 18, w, h,
      ),
      stormLayer(
        Math.round((mobile ? 22 : 46) * (w / 1280) * 1.6),
        260, 0.15, 1.2, 16, 28, w, h,
      ),
      stormLayer(
        Math.round((mobile ? 12 : 26) * (w / 1280) * 1.6),
        430, 0.21, 1.6, 24, 42, w, h,
      ),
    ];
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: (i / 4) * w + Math.random() * w * 0.2,
      y: -h * 0.04 - Math.random() * h * 0.08,
      r: w * (0.22 + Math.random() * 0.16),
      drift: (Math.random() - 0.5) * 8, // px/сек
    }));
  };

  return {
    resize(w, h) {
      W = w;
      H = h;
      spawn();
    },
    frame(g, t, dt) {
      // Ветер слегка качает угол дождя (12–18° от вертикали).
      const angle =
        0.26 + Math.sin(t / 4.2) * 0.05 + Math.sin(t / 1.7) * 0.02;
      const dx = Math.sin(angle);
      const dy = Math.cos(angle);

      let boltAlpha = 0;
      let flashAlpha = 0;

      if (dt > 0) {
        // Дождь: капли летят по направлению (dx, -dy), вылетевшие
        // перезапускаются сверху.
        for (const layer of layers) {
          for (const d of layer.drops) {
            d.x += dx * layer.speed * dt;
            d.y += dy * layer.speed * dt;
            if (d.y - d.len > H || d.x > W * 1.2) {
              d.x = Math.random() * (W * 1.3) - W * 0.15;
              d.y = -d.len - Math.random() * H * 0.2;
              d.len = layer.lenMin + Math.random() * (layer.lenMax - layer.lenMin);
            }
          }
        }
        // Тучи ползут и заворачиваются по кругу.
        for (const c of clouds) {
          c.x += c.drift * dt;
          if (c.x - c.r > W) c.x = -c.r;
          if (c.x + c.r < 0) c.x = W + c.r;
        }
        // Молния: раз в 4–14 секунд; видимая ~220 мс, за ней двойная
        // вспышка всего фона (как у реальной молнии).
        if (!bolt && t >= nextBoltAt) {
          bolt = makeBolt(W, H);
        }
        if (bolt) {
          bolt.life += dt * 1000;
          const ms = bolt.life;
          if (ms < 220) {
            // Двойная вспышка: пик → провал → второй пик → затухание.
            boltAlpha = 0.85;
            flashAlpha =
              ms < 60
                ? 0.3
                : ms < 100
                  ? 0.1
                  : ms < 160
                    ? 0.22
                    : 0.3 * (1 - (ms - 160) / 60);
          } else {
            bolt = null;
            nextBoltAt = t + 4 + Math.random() * 10;
          }
        }
      } else {
        bolt = null; // статичный кадр (reduced-motion) — без вспышек
      }

      // Тяжёлые тучи сверху: тёмные размытые пятна медленно ползут.
      for (const c of clouds) {
        const grad = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        grad.addColorStop(0, "rgba(38, 52, 72, 0.34)");
        grad.addColorStop(1, "rgba(38, 52, 72, 0)");
        g.fillStyle = grad;
        g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      }

      // Косой дождь: штрихи под углом angle от вертикали.
      g.lineCap = "round";
      for (const layer of layers) {
        g.strokeStyle = `rgba(158, 186, 216, ${layer.alpha})`;
        g.lineWidth = layer.width;
        g.beginPath();
        for (const d of layer.drops) {
          g.moveTo(d.x, d.y);
          g.lineTo(d.x - dx * d.len, d.y + dy * d.len);
        }
        g.stroke();
      }

      // Молния: яркая ломаная с ответвлениями и мягким свечением.
      if (bolt && boltAlpha > 0) {
        g.save();
        g.globalAlpha = boltAlpha;
        g.strokeStyle = "rgba(214, 232, 255, 0.9)";
        g.shadowColor = "rgba(190, 216, 255, 0.9)";
        g.shadowBlur = 14;
        g.lineWidth = 1.8;
        g.beginPath();
        bolt.points.forEach(([x, y], i) =>
          i === 0 ? g.moveTo(x, y) : g.lineTo(x, y),
        );
        g.stroke();
        g.lineWidth = 1;
        g.globalAlpha = boltAlpha * 0.7;
        for (const branch of bolt.branches) {
          g.beginPath();
          branch.forEach(([x, y], i) =>
            i === 0 ? g.moveTo(x, y) : g.lineTo(x, y),
          );
          g.stroke();
        }
        g.restore();
      }

      // Вспышка всего фона (после удара; двойная — как настоящая молния).
      if (flashAlpha > 0) {
        g.fillStyle = `rgba(214, 230, 255, ${flashAlpha})`;
        g.fillRect(0, 0, W, H);
      }
    },
  };
};
