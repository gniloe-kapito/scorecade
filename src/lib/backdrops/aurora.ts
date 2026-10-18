/* «Аврора»: занавесы северного сияния. Для каждого цвета заранее
 * рисуется узкий вертикальный спрайт-градиент; каждый кадр он
 * растягивается по высоте полосками шириной 8 px с шагом 4 px
 * (перекрытие ровно в два слоя — иначе «гребёнка»); режим lighter,
 * яркость переливается произведением двух синусов. Сверху крошечные
 * звёзды. Перенесено из референса без изменения алгоритма. */

import { clamp, rgba, rng, sprite, TAU, type Renderer, type RendererFactory } from "./utils";

/** Цвет занавеса → вертикальный спрайт (яркая верхняя кромка, растворение вниз). */
const makeCurtain = (c: readonly [number, number, number]) =>
  sprite(2, 256, (g, _w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, rgba(c[0], c[1], c[2], 0));
    gr.addColorStop(0.07, rgba(c[0], c[1], c[2], 1));
    gr.addColorStop(0.22, rgba(c[0], c[1], c[2], 0.55));
    gr.addColorStop(0.6, rgba(c[0], c[1], c[2], 0.14));
    gr.addColorStop(1, rgba(c[0], c[1], c[2], 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 2, h);
  });

const SP = [
  makeCurtain([96, 255, 176]),
  makeCurtain([80, 236, 214]),
  makeCurtain([160, 130, 255]),
  makeCurtain([96, 170, 255]),
];

/** [индекс цвета, базовая высота, фаза, множитель яркости] */
const CFG: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0.16, 0.0, 1],
  [1, 0.23, 2.1, 0.85],
  [2, 0.3, 4.0, 0.7],
  [3, 0.19, 5.3, 0.75],
];

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  const R = rng(51);
  let stars: Array<{ x: number; y: number; ph: number; f: number }> = [];

  return {
    resize(w, h) {
      W = w;
      H = h;
      stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
        x: R() * w,
        y: R() * h * 0.65,
        ph: R() * TAU,
        f: 0.5 + R() * 2,
      }));
    },
    frame(g, t) {
      g.globalCompositeOperation = "lighter";
      for (const s of stars) {
        g.globalAlpha = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(t * s.f + s.ph));
        g.fillStyle = "#dff";
        g.fillRect(s.x, s.y, 1.3, 1.3);
      }
      for (const [si, by, ph, k] of CFG) {
        const step = 4;
        for (let x = -10; x < W + 10; x += step) {
          const y =
            H * by +
            Math.sin(x * 0.0042 + t * 0.14 + ph) * H * 0.07 +
            Math.sin(x * 0.012 - t * 0.23 + ph * 1.7) * H * 0.025;
          const len =
            H *
            (0.26 +
              0.14 * Math.sin(x * 0.006 + t * 0.19 + ph * 1.3) +
              0.06 * Math.sin(x * 0.021 - t * 0.5 + ph));
          const sh =
            0.5 +
            0.5 *
              Math.sin(x * 0.019 + t * 0.9 + ph * 3) *
              Math.sin(x * 0.0057 - t * 0.4 + ph);
          g.globalAlpha = clamp(0.22 + 0.48 * sh, 0, 1) * 0.55 * k;
          g.drawImage(SP[si], 0, 0, 2, 256, x - step / 2, y, step * 2, len);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    },
  };
};
