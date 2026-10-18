/* «Матрица»: вертикальные колонки символов (катакана/цифры/латиница)
 * падают с разной скоростью; у колонки яркая «голова» и затухающий
 * хвост, символы иногда меняются. Перенесено из ThemeCanvas.tsx
 * (раньше рендерился отдельной функцией) без изменения визуала. */

import type { Renderer, RendererFactory } from "./utils";

const CHAR_H = 17;

/** Набор символов: полуширинная катакана + цифры + латиница. */
const MATRIX_CHARS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const matrixChar = () =>
  MATRIX_CHARS[(Math.random() * MATRIX_CHARS.length) | 0];

interface MatrixColumn {
  x: number;
  y: number; // позиция «головы»
  speed: number; // px/сек
  chars: string[];
}

export const create: RendererFactory = () => {
  let W = 0;
  let H = 0;
  let cols: MatrixColumn[] = [];

  const spawn = () => {
    // Плотность зависит от ширины: колонка ~22px, на телефоне реже.
    const gap = W < 640 ? 26 : 22;
    const count = Math.min(90, Math.ceil(W / gap));
    cols = Array.from({ length: count }, (_, i) => {
      const trail = 6 + ((Math.random() * 14) | 0);
      return {
        x: ((i + 0.5) / count) * W,
        y: Math.random() * H * 2 - H,
        speed: 60 + Math.random() * 160,
        chars: Array.from({ length: trail }, matrixChar),
      };
    });
  };

  return {
    resize(w, h) {
      W = w;
      H = h;
      spawn();
    },
    frame(g, _t, dt) {
      if (dt > 0) {
        for (const col of cols) {
          col.y += col.speed * dt;
          // Голова ушла за низ — колонка перезапускается сверху со сменой
          // скорости и длины.
          if (col.y - col.chars.length * CHAR_H > H) {
            col.y = -Math.random() * H * 0.5;
            col.speed = 60 + Math.random() * 160;
            const trail = 6 + ((Math.random() * 14) | 0);
            col.chars = Array.from({ length: trail }, matrixChar);
          }
        }
      }
      g.font = "15px ui-monospace, SFMono-Regular, Menlo, monospace";
      g.textBaseline = "top";
      for (const col of cols) {
        const trail = col.chars.length;
        for (let i = 0; i < trail; i++) {
          const y = col.y - i * CHAR_H;
          if (y < -CHAR_H || y > H + CHAR_H) continue;
          // Голова ярче, хвост затухает до нуля. Средняя яркость ~0.25 —
          // фон остаётся фоном и не спорит с контентом.
          const fade = 1 - i / trail;
          const alpha = i === 0 ? 0.5 : 0.32 * fade * fade;
          g.fillStyle =
            i === 0
              ? `rgba(178, 255, 171, ${alpha})`
              : `rgba(125, 217, 119, ${alpha})`;
          g.fillText(col.chars[i], col.x, y);
          // Символ иногда меняется — колонка «живая».
          if (dt > 0 && i > 0 && Math.random() < 0.006) {
            col.chars[i] = matrixChar();
          }
        }
      }
    },
  };
};
