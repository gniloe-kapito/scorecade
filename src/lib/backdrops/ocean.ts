/* «Океан»: тихая прозрачная вода. Сверху — светящаяся поверхность
 * с медленно бегущими волнами бликов, из неё вниз расходятся мягкие
 * лучи, под поверхностью дрейфуют большие пятны света («зайчики» от
 * волн), со дна поднимаются пузырьки.
 *
 * Полная переработка v3 (прежние версии ругали за мерцание, шум и
 * нагрузку): в кадре НИКАКОЙ попиксельной работы и никаких
 * регенерирующихся паттернов — только медленные непрерывные движения,
 * поэтому мигать нечему. Всё, что движется, — это заранее
 * нарисованные спрайты и градиентные заливки:
 *   фон     — один вертикальный градиент глубины (1 fillRect);
 *   панель  — светлее у поверхности + темнее ко дну (2 fillRect);
 *   блики   — ~9 растянутых мягких «зайчиков» (1 спрайт × drawImage),
 *             дрейфуют по горизонтали с обёрткой и дышат яркостью;
 *   волны   — 3 синусоидальные линии у поверхности (3 stroke);
 *   лучи    — 5 мягких трапеций с градиентом (10 fill);
 *   пузырьки — контур + блик.
 * Время кадра ~0,3–0,5 мс; статичный кадр (t=8) — та же картина. */

import { clamp, rgba, rng, sprite, TAU, type Renderer, type RendererFactory } from "./utils";

interface Ripple {
  /** Положение «зайчика»: 0..1 по ширине, домножаем на W с обёрткой. */
  x: number;
  y: number; // 0..1 от высоты (зайчики живут в верхней половине)
  w: number; // ширина, доля от W
  v: number; // скорость дрейфа, доли ширины в секунду (медленно)
  ph: number;
  f: number;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  v: number;
  ph: number;
  f: number;
}

/** Мягкий «зайчик» света — эллипс с радиальным градиентом (спрайт). */
function lightSprite(): HTMLCanvasElement {
  return sprite(160, 96, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(205,246,238,.5)");
    gr.addColorStop(0.45, "rgba(150,228,214,.2)");
    gr.addColorStop(1, "rgba(120,205,196,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let R = rng(41);
  let ripples: Ripple[] = [];
  let Bu: Bubble[] = [];
  let glint = lightSprite();

  return {
    resize(w, h) {
      W = w;
      H = h;
      R = rng(41);
      glint = lightSprite();
      /* Зайчики света: 8–10 штук, все в верхней половине (там, где
       * свету пройти сквозь поверхность проще всего). */
      const n = clamp(Math.round(w / 130), 8, 12);
      ripples = Array.from({ length: n }, () => ({
        x: R(),
        y: 0.06 + R() * 0.34,
        w: 0.16 + R() * 0.16,
        v: (R() < 0.5 ? -1 : 1) * (0.008 + R() * 0.014),
        ph: R() * TAU,
        f: 0.1 + R() * 0.22,
      }));
      const bn = clamp(Math.round(w / 38), 12, 30);
      Bu = Array.from({ length: bn }, () => ({
        x: R() * w,
        y: R() * h,
        r: 1.5 + R() * 4.5,
        v: 12 + R() * 34,
        ph: R() * TAU,
        f: 0.6 + R() * 1.4,
      }));
    },

    frame(g, t, dt) {
      /* Градиент глубины: светлая вода у поверхности, тёмная ко дну. */
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "rgba(46,116,134,.5)");
      bg.addColorStop(0.4, "rgba(24,74,94,.3)");
      bg.addColorStop(1, "rgba(9,26,38,.06)");
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      g.globalCompositeOperation = "lighter";

      /* Дыхание общей освещённости — очень медленное, едва заметное. */
      const sun = 0.9 + 0.1 * Math.sin(t * 0.21 + 1.2);

      /* Зайчики света под поверхностью. */
      for (const rp of ripples) {
        if (dt > 0) {
          rp.x += rp.v * dt;
          if (rp.x < -0.35) rp.x += 1.7;
          if (rp.x > 1.35) rp.x -= 1.7;
        }
        const cx = rp.x * W;
        const cy = rp.y * H;
        const rw = rp.w * W;
        const rh = rw * 0.34;
        const br = 0.55 + 0.45 * Math.sin(t * rp.f + rp.ph);
        g.globalAlpha = clamp(0.16 + 0.3 * br, 0, 1) * sun;
        g.drawImage(glint, cx - rw / 2, cy - rh / 2, rw, rh);
      }
      g.globalAlpha = 1;

      /* Поверхность воды (вид снизу): 3 светящиеся волнистые линии,
       * которые медленно ползут влево и волнуются. */
      for (let k = 0; k < 3; k++) {
        const y0 = H * (0.035 + k * 0.032);
        const amp = H * (0.016 + 0.008 * Math.sin(t * 0.4 + k * 2.1));
        const wl = W * (0.9 + 0.35 * k);
        const drift = t * (14 + k * 7) + k * 900;
        const fade = g.createLinearGradient(0, y0 - amp * 2, 0, y0 + H * 0.1);
        fade.addColorStop(0, rgba(215, 250, 242, (0.34 - k * 0.09) * sun));
        fade.addColorStop(1, "rgba(160,225,215,0)");
        g.strokeStyle = fade;
        g.lineWidth = 1.6 + k * 0.7;
        g.beginPath();
        for (let x = -20; x <= W + 20; x += 14) {
          const y =
            y0 +
            Math.sin((x + drift) / wl * TAU) * amp +
            Math.sin((x + drift * 1.7) / (wl * 0.31) + k) * amp * 0.35;
          if (x <= -20) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }

      /* Яркое пятно прямо у кромки — свет пробивается сквозь поверхность. */
      const surf = g.createLinearGradient(0, 0, 0, H * 0.16);
      surf.addColorStop(0, rgba(200, 245, 236, 0.22 * sun));
      surf.addColorStop(1, "rgba(200,245,236,0)");
      g.fillStyle = surf;
      g.fillRect(0, 0, W, H * 0.16);

      /* Косые лучи света: мягкие трапеции, медленно качаются. */
      for (let i = 0; i < 5; i++) {
        const x0 = W * (0.08 + 0.21 * i) + Math.sin(t * 0.09 + i * 1.7) * W * 0.04;
        const spread0 = W * (0.07 + 0.04 * Math.sin(t * 0.13 + i));
        const ang = 0.26 + Math.sin(t * 0.07 + i * 2) * 0.06;
        const x1 = x0 - Math.tan(ang) * H * 1.1;
        const pa = 0.08 + 0.04 * Math.sin(t * 0.33 + i * 1.3);
        for (const [wk, ak] of [
          [1.8, 0.4],
          [1, 0.75],
        ] as const) {
          const spread = spread0 * wk;
          const gr = g.createLinearGradient(x0, 0, x1, H);
          gr.addColorStop(0, rgba(190, 245, 235, pa * ak));
          gr.addColorStop(0.6, rgba(150, 225, 220, pa * ak * 0.32));
          gr.addColorStop(1, "rgba(120,210,210,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(x0 - spread * 0.25, -10);
          g.lineTo(x0 + spread * 0.25, -10);
          g.lineTo(x1 + spread * 1.2, H);
          g.lineTo(x1 - spread * 1.2, H);
          g.closePath();
          g.fill();
        }
      }

      /* Пузырьки. */
      g.globalCompositeOperation = "source-over";
      for (const b of Bu) {
        if (dt > 0) {
          b.y -= b.v * dt;
          b.x += Math.sin(t * b.f + b.ph) * 10 * dt;
          if (b.y < -10) {
            b.y = H + 10;
            b.x = R() * W;
          }
        }
        const a = 0.35 * clamp(b.y / (H * 0.3), 0.2, 1);
        g.fillStyle = rgba(190, 240, 235, a * 0.22);
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(200, 245, 240, a);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, TAU);
        g.stroke();
        g.fillStyle = rgba(235, 255, 255, a * 1.2);
        g.beginPath();
        g.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.22), 0, TAU);
        g.fill();
      }
    },
  };
};
