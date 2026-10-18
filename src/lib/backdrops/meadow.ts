/* «Луг»: светлый зелёный день. Три слоя холмов (дальние бледнее),
 * на двух передних — трава: над кромкой холма сплошной «ковёр» с
 * зубчатым силуэтом (сотни мелких треугольных пучков одним
 * fill-путём — масса без просветов), поверх колышутся высокие
 * травинки бегущей волной ветра. В левом верхнем углу тёплое солнце
 * и мягкие лучи, в воздухе плывут пушинки одуванчика.
 *
 * Отличие от референса (просьба пользователя: «всё устраивает, кроме
 * травы — вместо палочек плотнее, но чтобы не нагружала»): масса
 * травы — это зубчатый край холма (один fill, ~0,3 мс), а не тысячи
 * отдельных штрихов; тонкие травинки над массой — пакетные stroke
 * по оттенкам/толщинам, как в референсе. */

import { rgba, rng, TAU, type Renderer, type RendererFactory } from "./utils";

interface Hill {
  base: number;
  a1: number;
  f1: number;
  p1: number;
  a2: number;
  f2: number;
  p2: number;
  c: readonly [number, number, number, number];
  /** Бахрома кромки: ширины зубцов и их высоты (статичные). */
  fringe: Array<{ dx: number; sp: number }>;
}

interface Blade {
  x: number;
  y: number;
  h: number;
  c: number; // оттенок 0..2
  w: number; // толщина: 0 тонкая, 1 потолще
  lean: number; // постоянный наклон
  l: number; // слой (0 — средний холм, 1 — передний)
}

interface Seed {
  x: number;
  y: number;
  v: number;
  ph: number;
  s: number;
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let hills: Hill[] = [];
  let blades: Blade[] = [];
  let seeds: Seed[] = [];
  const R = rng(71);

  const wind = (x: number, t: number) =>
    Math.sin(x * 0.009 - t * 1.2) * 0.6 +
    Math.sin(x * 0.023 - t * 2.1 + 1) * 0.3 +
    Math.sin(t * 0.35) * 0.25;

  const hillY = (h: Hill, x: number) =>
    h.base + Math.sin(x * h.f1 + h.p1) * h.a1 + Math.sin(x * h.f2 + h.p2) * h.a2;

  return {
    resize(w, h) {
      W = w;
      H = h;
      const mkHill = (
        base: number,
        a1: number,
        f1: number,
        p1: number,
        a2: number,
        f2: number,
        p2: number,
        c: readonly [number, number, number, number],
        grassy: boolean,
      ): Hill => {
        const fringe: Array<{ dx: number; sp: number }> = [];
        if (grassy) {
          let x = 0;
          while (x < w + 8) {
            /* Неровная мелкая бахрома: ширина зубца 1.5–4px, высота
             * 2–6px, каждый десятый — пучок до 15px. */
            const dx = 1.5 + R() * 2.5;
            const sp = R() < 0.1 ? 9 + R() * 6 : 2 + R() * 4;
            fringe.push({ dx, sp });
            x += dx;
          }
        }
        return { base, a1, f1, p1, a2, f2, p2, c, fringe };
      };
      hills = [
        mkHill(h * 0.7, h * 0.045, 0.0042, 1, h * 0.02, 0.011, 2, [168, 206, 150, 0.75], false),
        mkHill(h * 0.8, h * 0.04, 0.0058, 3, h * 0.018, 0.014, 0.5, [128, 182, 104, 0.85], true),
        mkHill(h * 0.9, h * 0.03, 0.0075, 5, h * 0.014, 0.019, 4, [92, 150, 74, 0.95], true),
      ];
      /* Высокие травинки над массой: кустики, только палочки
       * заметной высоты — их качает волной ветра. */
      blades = [];
      hills.slice(1).forEach((hl, li) => {
        const step = w < 640 ? (li ? 3.4 : 4.6) : li ? 3.0 : 4.0;
        const n = Math.round(w / step);
        for (let i = 0; i < n; i++) {
          const x = R() * w;
          const tuft = 2 + Math.floor(R() * 2);
          for (let k = 0; k < tuft; k++) {
            const bx = x + (R() - 0.5) * 4;
            blades.push({
              x: bx,
              y: hillY(hl, bx),
              h: (li ? 18 : 13) + R() * (li ? 28 : 18),
              c: Math.floor(R() * 3),
              w: R() < 0.35 ? 1 : 0,
              lean: (R() - 0.5) * 0.5,
              l: li,
            });
          }
        }
      });
      seeds = Array.from({ length: 14 }, () => ({
        x: R() * w,
        y: h * (0.3 + 0.5 * R()),
        v: 8 + R() * 14,
        ph: R() * TAU,
        s: 5 + R() * 5,
      }));
    },

    frame(g, t, dt) {
      /* Солнце и мягкие лучи из левого верхнего угла. */
      const sg = g.createRadialGradient(W * 0.15, -H * 0.05, 0, W * 0.15, -H * 0.05, H * 0.9);
      sg.addColorStop(0, "rgba(255,248,196,.75)");
      sg.addColorStop(1, "rgba(255,248,196,0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const a = 0.55 + i * 0.13 + Math.sin(t * 0.08 + i) * 0.04;
        const len = H * 1.4;
        const x = W * 0.15;
        const y = -H * 0.05;
        const wd = 0.07 + 0.03 * Math.sin(t * 0.2 + i * 2);
        const gr = g.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
        gr.addColorStop(0, "rgba(255,250,210,.17)");
        gr.addColorStop(1, "rgba(255,250,210,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a - wd) * len, y + Math.sin(a - wd) * len);
        g.lineTo(x + Math.cos(a + wd) * len, y + Math.sin(a + wd) * len);
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = "source-over";

      hills.forEach((hl, li) => {
        const wobble = (x: number) => Math.sin(x * 0.01 - t * 0.8 + li) * 1.2;
        /* Холм: заливка с тёмной кромкой (масса травы в тени). */
        const crestGrad = g.createLinearGradient(0, hl.base - H * 0.1, 0, hl.base + H * 0.06);
        crestGrad.addColorStop(0, rgba(hl.c[0] * 0.52, hl.c[1] * 0.52, hl.c[2] * 0.52, hl.c[3]));
        crestGrad.addColorStop(1, rgba(hl.c[0], hl.c[1], hl.c[2], hl.c[3]));
        g.fillStyle = li > 0 ? crestGrad : rgba(hl.c[0], hl.c[1], hl.c[2], hl.c[3]);
        g.beginPath();
        g.moveTo(0, H);
        if (li > 0) {
          /* Бахрома кромки — «ковёр» травы одним путём; зубцы слегка
           * дышат от ветра (высота × (1 + 0.22·wind)). */
          let x = 0;
          for (const seg of hl.fringe) {
            const yb = hillY(hl, x) + wobble(x);
            const sp = seg.sp * (1 + 0.22 * wind(x, t));
            g.lineTo(x + seg.dx * 0.4, yb - sp);
            g.lineTo(x + seg.dx, yb);
            x += seg.dx;
          }
        } else {
          for (let x = 0; x <= W + 8; x += 8) {
            g.lineTo(x, hillY(hl, x) + wobble(x));
          }
        }
        g.lineTo(W, H);
        g.closePath();
        g.fill();

        if (li > 0) {
          /* Высокие травинки над массой: три оттенка × две толщины,
           * пакетные stroke — качаются бегущей волной. */
          const cols = ["rgba(64,122,50,.9)", "rgba(98,156,66,.9)", "rgba(132,180,86,.85)"];
          const widths = [li === 2 ? 1.5 : 1.2, li === 2 ? 2.3 : 1.8];
          for (let c = 0; c < 3; c++) {
            for (let wi = 0; wi < 2; wi++) {
              g.strokeStyle = cols[c];
              g.lineWidth = widths[wi];
              g.beginPath();
              for (const b of blades) {
                if (b.l !== li - 1 || b.c !== c || b.w !== wi) continue;
                const sw = (wind(b.x, t) + b.lean) * b.h * 0.55;
                g.moveTo(b.x, b.y + 2);
                g.quadraticCurveTo(b.x + sw * 0.25, b.y - b.h * 0.55, b.x + sw, b.y - b.h);
              }
              g.stroke();
            }
          }
        }
      });

      /* Пушинки одуванчика. */
      g.strokeStyle = "rgba(255,255,255,.75)";
      g.fillStyle = "rgba(255,255,255,.85)";
      g.lineWidth = 0.7;
      for (const s of seeds) {
        if (dt > 0) {
          s.x += (14 + wind(s.x, t) * 20) * dt;
          s.y -= s.v * dt * 0.35 + Math.sin(t * 0.8 + s.ph) * 6 * dt;
          if (s.x > W + 20) {
            s.x = -20;
            s.y = H * (0.3 + 0.5 * R());
          }
          if (s.y < -20) s.y = H * 0.9;
        }
        g.beginPath();
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI / 2 + (k - 4) * 0.32;
          g.moveTo(s.x, s.y);
          g.lineTo(s.x + Math.cos(a) * s.s, s.y + Math.sin(a) * s.s);
        }
        g.stroke();
        g.beginPath();
        g.arc(s.x, s.y, 1.1, 0, TAU);
        g.fill();
        g.strokeStyle = "rgba(120,150,100,.5)";
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x - s.s * 0.15, s.y + s.s * 0.9);
        g.stroke();
        g.strokeStyle = "rgba(255,255,255,.75)";
      }
    },
  };
};
