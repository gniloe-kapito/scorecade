"use client";

// Canvas-фоны для тем «Матрица» и «Гроза» — уникальный визуальный язык,
// непохожий на неон и друг на друга:
//  - Матрица: вертикальные колонки символов (катакана/цифры/латиница)
//    падают с разной скоростью; у колонки яркая «голова» и затухающий
//    хвост, символы иногда меняются.
//  - Гроза: косой дождь (12–18° от вертикали) в 2–3 слоя параллакса,
//    ветер качает угол, сверху ползут тёмные тучи, изредка бьёт
//    зигзагообразная молния с двойной вспышкой фона.
//
// Производительность: requestAnimationFrame с ограничением ~30 FPS,
// devicePixelRatio учитывается, но не выше 2; пересчёт размера по resize;
// анимация останавливается, когда вкладка скрыта (visibilitychange) и
// при смене темы; все слушатели и rAF снимаются при размонтировании.
// prefers-reduced-motion: один статичный кадр, без вспышек.

import { useEffect, useRef } from "react";

type StopFn = () => void;

const FRAME_MS = 1000 / 30; // ~30 FPS
const TAU = Math.PI * 2;

/** Набор символов «матрицы»: полуширинная катакана + цифры + латиница. */
const MATRIX_CHARS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const matrixChar = () =>
  MATRIX_CHARS[(Math.random() * MATRIX_CHARS.length) | 0];

/** Дроп-фрейм: вызывает tick(now), пока не вернёт false. */
function runFrames(tick: (now: number) => boolean): StopFn {
  let stopped = false;
  let rafId = 0;
  let last = 0;
  const loop = (now: number) => {
    if (stopped) return;
    if (now - last >= FRAME_MS) {
      last = now - ((now - last) % FRAME_MS);
      if (!tick(now)) return; // рендерер закончился сам
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  // Пауза при скрытой вкладке: rAF в браузере и так замирает, но
  // перестрахуемся и не рисуем вслепую после возвращения (большой dt).
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else if (!stopped) {
      last = 0;
      rafId = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Подгонка canvas под размер окна с devicePixelRatio (≤2). */
function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }
  return { w, h };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ==================== Матрица ==================== */

interface MatrixColumn {
  x: number;
  y: number; // позиция «головы» (px/кадр считается из speed)
  speed: number; // px/сек
  chars: string[];
  charH: number;
}

function drawMatrixFrame(
  ctx: CanvasRenderingContext2D,
  cols: MatrixColumn[],
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textBaseline = "top";
  for (const col of cols) {
    const trail = col.chars.length;
    for (let i = 0; i < trail; i++) {
      const y = col.y - i * col.charH;
      if (y < -col.charH || y > h + col.charH) continue;
      // Голова ярче, хвост затухает до нуля. Средняя яркость ~0.25 —
      // фон остаётся фоном и не спорит с контентом.
      const fade = 1 - i / trail;
      const alpha = i === 0 ? 0.5 : 0.32 * fade * fade;
      ctx.fillStyle =
        i === 0
          ? `rgba(178, 255, 171, ${alpha})`
          : `rgba(125, 217, 119, ${alpha})`;
      ctx.fillText(col.chars[i], col.x, y);
      // Символ иногда меняется — колонка «живая».
      if (i > 0 && Math.random() < 0.006) col.chars[i] = matrixChar();
    }
  }
}

function runMatrix(canvas: HTMLCanvasElement): StopFn {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  let size = fitCanvas(canvas);
  const charH = 17;
  const spawn = () => {
    // Плотность зависит от ширины: колонка ~22px, на телефоне реже.
    const gap = size.w < 640 ? 26 : 22;
    const count = Math.min(90, Math.ceil(size.w / gap));
    const cols: MatrixColumn[] = [];
    for (let i = 0; i < count; i++) {
      const trail = 6 + ((Math.random() * 14) | 0);
      cols.push({
        x: ((i + 0.5) / count) * size.w,
        y: Math.random() * size.h * 2 - size.h,
        speed: 60 + Math.random() * 160,
        chars: Array.from({ length: trail }, matrixChar),
        charH,
      });
    }
    return cols;
  };
  let cols = spawn();

  const onResize = () => {
    size = fitCanvas(canvas);
    cols = spawn();
  };
  window.addEventListener("resize", onResize, {
    passive: true,
  });

  if (prefersReducedMotion()) {
    // Статичный кадр: колонки на случайных высотах — без движения.
    drawMatrixFrame(ctx, cols, size.w, size.h);
    return () => window.removeEventListener("resize", onResize);
  }

  let lastT = 0;
  const stop = runFrames((now) => {
    const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 1 / 30);
    lastT = now;
    for (const col of cols) {
      col.y += col.speed * dt;
      // Голова ушла за низ — колонка перезапускается сверху со сменой
      // скорости и длины.
      if (col.y - col.chars.length * charH > size.h) {
        col.y = -Math.random() * size.h * 0.5;
        col.speed = 60 + Math.random() * 160;
        const trail = 6 + ((Math.random() * 14) | 0);
        col.chars = Array.from({ length: trail }, matrixChar);
      }
    }
    drawMatrixFrame(ctx, cols, size.w, size.h);
    return true;
  });

  return () => {
    stop();
    window.removeEventListener("resize", onResize);
  };
}

/* ==================== Гроза ==================== */

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
  bornAt: number;
}

function stormLayer(
  count: number,
  speed: number,
  alpha: number,
  width: number,
  lenMin: number,
  lenMax: number,
  w: number,
  h: number,
): RainLayer {
  const drops = Array.from({ length: count }, () => ({
    x: Math.random() * (w * 1.3) - w * 0.15,
    y: Math.random() * h,
    len: lenMin + Math.random() * (lenMax - lenMin),
  }));
  return { drops, speed, alpha, width, lenMin, lenMax };
}

function drawStormFrame(
  ctx: CanvasRenderingContext2D,
  layers: RainLayer[],
  angle: number, // отклонение капли от вертикали (радианы)
  clouds: Array<{ x: number; y: number; r: number; drift: number }>,
  w: number,
  h: number,
  bolt: Bolt | null,
  boltAlpha: number,
  flashAlpha: number,
) {
  ctx.clearRect(0, 0, w, h);

  // Тяжёлые тучи сверху: тёмные размытые пятна медленно ползут.
  for (const c of clouds) {
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    grad.addColorStop(0, "rgba(38, 52, 72, 0.34)");
    grad.addColorStop(1, "rgba(38, 52, 72, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }

  // Косой дождь: штрихи под углом angle от вертикали.
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  ctx.lineCap = "round";
  for (const layer of layers) {
    ctx.strokeStyle = `rgba(158, 186, 216, ${layer.alpha})`;
    ctx.lineWidth = layer.width;
    ctx.beginPath();
    for (const d of layer.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - dx * d.len, d.y + dy * d.len);
    }
    ctx.stroke();
  }

  // Молния: яркая ломаная с ответвлениями и мягким свечением.
  if (bolt && boltAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = boltAlpha;
    ctx.strokeStyle = "rgba(214, 232, 255, 0.9)";
    ctx.shadowColor = "rgba(190, 216, 255, 0.9)";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    bolt.points.forEach(([x, y], i) =>
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
    );
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = boltAlpha * 0.7;
    for (const branch of bolt.branches) {
      ctx.beginPath();
      branch.forEach(([x, y], i) =>
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // Вспышка всего фона (после удара; двойная — как настоящая молния).
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(214, 230, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function makeBolt(w: number): Bolt {
  // Зигзаг сверху вниз со случайным дрожанием по горизонтали.
  const startX = w * (0.15 + Math.random() * 0.7);
  const points: Array<[number, number]> = [[startX, -20]];
  let x = startX;
  const steps = 8 + ((Math.random() * 5) | 0);
  for (let i = 1; i <= steps; i++) {
    x += (Math.random() - 0.5) * w * 0.06;
    points.push([x, (i / steps) * (window.innerHeight * 0.85)]);
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
  return { points, branches, bornAt: performance.now() };
}

function runStorm(canvas: HTMLCanvasElement): StopFn {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  let size = fitCanvas(canvas);
  let layers: RainLayer[] = [];
  let clouds: Array<{ x: number; y: number; r: number; drift: number }> = [];

  const spawn = () => {
    const { w, h } = size;
    const mobile = w < 640;
    // Три слоя параллакса: дальний — медленный и короткий, передний —
    // быстрый и длинный. На телефоне капель меньше.
    layers = [
      stormLayer(
        Math.round((mobile ? 34 : 70) * (w / 1280) * 1.6),
        130, 0.10, 1, 10, 18, w, h,
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
  spawn();

  const onResize = () => {
    size = fitCanvas(canvas);
    spawn();
  };
  window.addEventListener("resize", onResize, { passive: true });

  if (prefersReducedMotion()) {
    // Статичный кадр: косой дождь и тучи — без молний и вспышек.
    drawStormFrame(ctx, layers, 0.24, clouds, size.w, size.h, null, 0, 0);
    return () => window.removeEventListener("resize", onResize);
  }

  let bolt: Bolt | null = null;
  let nextBoltAt = performance.now() + 4000 + Math.random() * 8000;
  let lastT = 0;

  const stop = runFrames((now) => {
    const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 1 / 30);
    lastT = now;
    const { w, h } = size;

    // Ветер слегка качает угол дождя (12–18° от вертикали).
    const angle =
      0.26 + Math.sin(now / 4200) * 0.05 + Math.sin(now / 1700) * 0.02;

    // Дождь: капли летят по направлению (dx, -dy), вылетевшие
    // перезапускаются сверху.
    const dx = Math.sin(angle);
    const dy = Math.cos(angle);
    for (const layer of layers) {
      for (const d of layer.drops) {
        d.x += dx * layer.speed * dt;
        d.y += dy * layer.speed * dt;
        if (d.y - d.len > h || d.x > w * 1.2) {
          d.x = Math.random() * (w * 1.3) - w * 0.15;
          d.y = -d.len - Math.random() * h * 0.2;
          d.len = layer.lenMin + Math.random() * (layer.lenMax - layer.lenMin);
        }
      }
    }
    // Тучи ползут и заворачиваются по кругу.
    for (const c of clouds) {
      c.x += c.drift * dt;
      if (c.x - c.r > w) c.x = -c.r;
      if (c.x + c.r < 0) c.x = w + c.r;
    }

    // Молния: раз в 4–14 секунд; видимая ~220 мс, за ней двойная
    // вспышка всего фона (как у реальной молнии).
    let boltAlpha = 0;
    let flashAlpha = 0;
    if (!bolt && now >= nextBoltAt) {
      bolt = makeBolt(w);
    }
    if (bolt) {
      const t = now - bolt.bornAt;
      if (t < 220) {
        // Двойная вспышка: пик → провал → второй пик → затухание.
        boltAlpha = 0.85;
        flashAlpha =
          t < 60 ? 0.30 : t < 100 ? 0.10 : t < 160 ? 0.22 : 0.30 * (1 - (t - 160) / 60);
      } else {
        bolt = null;
        nextBoltAt = now + 4000 + Math.random() * 10000;
      }
    }

    drawStormFrame(ctx, layers, angle, clouds, w, h, bolt, boltAlpha, flashAlpha);
    return true;
  });

  return () => {
    stop();
    window.removeEventListener("resize", onResize);
  };
}

/* ==================== Компонент ==================== */

/**
 * Canvas-слой фона для тем «Гроза» и «Матрица». Следит за data-theme
 * на <html> (MutationObserver): включается только для своей темы,
 * при смене темы останавливается и очищается.
 */
export function ThemeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stop: StopFn | null = null;
    const clear = () => {
      stop?.();
      stop = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    const startFor = (theme: string | null) => {
      clear();
      if (theme === "matrix") stop = runMatrix(canvas);
      else if (theme === "storm") stop = runStorm(canvas);
    };

    startFor(document.documentElement.getAttribute("data-theme"));
    const observer = new MutationObserver(() => {
      startFor(document.documentElement.getAttribute("data-theme"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      clear();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="theme-canvas"
      aria-hidden
      // Слой фона не должен ловить события и попадать в tab-порядок.
      tabIndex={-1}
    />
  );
}
