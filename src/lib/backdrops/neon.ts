/* «Неон»: синтвейв. Тёмно-фиолетовое небо, на горизонте большое
 * полосатое солнце (прорези медленно ползут вниз), маджентовое
 * свечение пульсирует, под горизонтом — уходящая к нему сетка в
 * перспективе, яркая линия горизонта.
 *
 * Отличие от референса (просьба пользователя): пол в демо
 * воспринимался «едущим из центра ещё и в сторону» — виноваты яркие
 * лучи, расходящиеся веером из точки схода. Здесь перспектива
 * построена на ГЛАВНОМ движении — горизонтальные линии летят на
 * зрителя; лучи — лишь тихие направляющие: их меньше, они тоньше и
 * заметно тусклее, у горизонта растворяются. */

import { rgba, sprite, TAU, type Renderer, type RendererFactory } from "./utils";

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let sun: HTMLCanvasElement | null = null;
  let sunR = 0;

  return {
    resize(w, h) {
      W = w;
      H = h;
      const r = Math.round(h * 0.2);
      sunR = r;
      sun = sprite(r * 2 + 4, r * 2 + 4, (g, sw, sh) => {
        const gr = g.createLinearGradient(0, 0, 0, sh);
        gr.addColorStop(0, "rgb(255,214,120)");
        gr.addColorStop(0.5, "rgb(255,110,170)");
        gr.addColorStop(1, "rgb(190,70,220)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(sw / 2, sh / 2, r, 0, TAU);
        g.fill();
      });
    },

    frame(g, t) {
      const s = sun;
      if (!s) return;
      const hy = H * 0.58;
      const cx = W / 2;
      const pulse = 0.75 + 0.25 * Math.sin(t * 0.9);

      /* Маджентовое свечение над горизонтом. */
      const sg = g.createRadialGradient(cx, hy, 0, cx, hy, H * 0.6);
      sg.addColorStop(0, rgba(255, 80, 190, 0.38 * pulse));
      sg.addColorStop(0.5, "rgba(150,60,220,.14)");
      sg.addColorStop(1, "rgba(100,40,200,0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);

      /* Полосатое солнце: спрайт + вырезанные прорези (клип по
       * горизонту — ниже его солнце не рисуется). */
      const r = sunR;
      const sx = cx;
      const sy = hy - r * 0.3;
      const tmp = sprite(s.width, s.height, (q) => {
        q.drawImage(s, 0, 0);
        q.globalCompositeOperation = "destination-out";
        q.fillStyle = "#000";
        for (let i = 0; i < 9; i++) {
          const k = (i + (t * 0.2) % 1) / 9;
          const y = s.height * (0.36 + 0.64 * k);
          const th = 1.5 + k * r * 0.13;
          q.fillRect(0, y, s.width, th * Math.min(1, k * 1.8));
        }
      });
      g.save();
      g.beginPath();
      g.rect(0, 0, W, hy);
      g.clip();
      g.globalAlpha = 0.8;
      g.drawImage(tmp, sx - s.width / 2, sy - s.height / 2);
      g.restore();

      /* Земля под горизонтом. */
      g.fillStyle = "rgba(18,10,40,.62)";
      g.fillRect(0, hy, W, H - hy);

      g.globalCompositeOperation = "lighter";

      /* Горизонтальные линии сетки — ГЛАВНОЕ движение: летят на
       * зрителя с перспективным ускорением. */
      const off = (t * 0.22) % 1;
      const M = 14;
      for (let k = 0; k < M; k++) {
        const z = (k + off) / M;
        const y = hy + (H - hy) * Math.pow(z, 2.3);
        const a = 0.15 + 0.85 * z;
        g.strokeStyle = rgba(70, 226, 234, a * 0.18);
        g.lineWidth = 5 * z + 2;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
        g.strokeStyle = rgba(120, 244, 248, a * 0.8);
        g.lineWidth = 0.8 + 1.1 * z;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }

      /* Лучи — тихие направляющие (не веер): меньше, тоньше, тусклее,
       * у горизонта растворяются, чтобы пол читался летящим ВПЕРЁД. */
      const N = 12;
      const sp = W * 0.16;
      const fa = g.createLinearGradient(0, hy, 0, H);
      fa.addColorStop(0, "rgba(255,92,196,0)");
      fa.addColorStop(0.4, "rgba(255,92,196,.1)");
      fa.addColorStop(1, "rgba(255,120,208,.3)");
      const fb = g.createLinearGradient(0, hy, 0, H);
      fb.addColorStop(0, "rgba(255,92,196,0)");
      fb.addColorStop(0.3, "rgba(255,92,196,.06)");
      fb.addColorStop(1, "rgba(255,92,196,.14)");
      for (let i = -N; i <= N; i++) {
        const xb = cx + i * sp;
        g.strokeStyle = fb;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(cx, hy);
        g.lineTo(xb, H);
        g.stroke();
        g.strokeStyle = fa;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx, hy);
        g.lineTo(xb, H);
        g.stroke();
      }

      /* Яркая линия горизонта. */
      const hl = g.createLinearGradient(0, hy - 6, 0, hy + 10);
      hl.addColorStop(0, "rgba(255,120,210,0)");
      hl.addColorStop(0.5, rgba(255, 170, 230, 0.9 * pulse));
      hl.addColorStop(1, "rgba(255,120,210,0)");
      g.fillStyle = hl;
      g.fillRect(0, hy - 6, W, 16);
      g.globalCompositeOperation = "source-over";
    },
  };
};
