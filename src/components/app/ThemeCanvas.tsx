"use client";

// Canvas-фон живых тем. Рендереры живут в реестре @/lib/backdrops:
// компонент следит за data-theme на <html> (MutationObserver — работает
// и с бутстрап-скриптом до первой отрисовки, и с applyTheme), берёт
// фабрику из реестра и гоняет кадры на ОДНОМ холсте.
//
// Производительность: ~30 кадров/с (rAF с аккумулятором), dpr ≤ 2,
// пересчёт размера по resize; цикл останавливается на скрытой вкладке
// (visibilitychange). Вместо анимации — один статичный кадр на 8-й
// секунде, когда анимация выключена:
//   • настройка «Анимация фона» (localStorage scorecade_motion):
//     авто (по prefers-reduced-motion) / включена / выключена —
//     меняется в настройках, применяется мгновенно;
//   • prefers-reduced-motion, пока выбрано «авто».
// При смене темы старый цикл и все слушатели снимаются.
// Появление холста — плавный fade-in 0.6с.

import { useEffect, useRef } from "react";
import { BACKDROPS } from "@/lib/backdrops";
import { MOTION_CHANGE_EVENT, motionAllowed } from "@/lib/motion";

const FRAME_DT = 1 / 30;

export function ThemeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;

    let teardown: (() => void) | null = null;

    const startFor = (theme: string | null) => {
      teardown?.();
      teardown = null;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      const make = theme ? BACKDROPS[theme] : undefined;
      if (!make) return;

      const rend = make();
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      let W = 0;
      let H = 0;
      let raf = 0;
      let last = 0;
      let acc = 0;
      let t = 8; // статичный кадр — на 8-й секунде
      let running = false;

      const draw = (dt: number) => {
        g.clearRect(0, 0, W, H);
        rend.frame(g, t, dt);
      };
      const fit = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        rend.resize(W, H);
        draw(0); // сразу показываем кадр (для стоп-кадра это и есть фон)
      };
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        acc += dt;
        if (acc < FRAME_DT) return; // не чаще ~30 кадров/с
        t += acc;
        draw(acc);
        acc = 0;
      };
      const start = () => {
        if (running || !motionAllowed(mq.matches) || document.hidden) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };
      const onVis = () => (document.hidden ? stop() : start());
      /** Настройка движения изменилась (настройки или система):
       *  запуск/остановка ЦИКЛА без пересоздания рендерера. */
      const onMotion = () => {
        if (motionAllowed(mq.matches)) start();
        else {
          stop();
          draw(0); // стоп-кадр вместо анимации
        }
      };
      /** Тема могла смениться, пока значение было невалидным. */
      const onStorageMotion = (e: StorageEvent) => {
        if (e.key === null || e.key === "scorecade_motion") onMotion();
      };

      // Перезапуск CSS-анимации fade-in при каждом старте новой темы.
      cv.style.animation = "none";
      cv.getBoundingClientRect();
      cv.style.animation = "";

      fit();
      if (motionAllowed(mq.matches)) t = 0; // анимация идёт с нуля
      start();
      window.addEventListener("resize", fit);
      document.addEventListener("visibilitychange", onVis);
      mq.addEventListener("change", onMotion);
      window.addEventListener(MOTION_CHANGE_EVENT, onMotion);
      window.addEventListener("storage", onStorageMotion);

      teardown = () => {
        stop();
        window.removeEventListener("resize", fit);
        document.removeEventListener("visibilitychange", onVis);
        mq.removeEventListener("change", onMotion);
        window.removeEventListener(MOTION_CHANGE_EVENT, onMotion);
        window.removeEventListener("storage", onStorageMotion);
      };
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
      teardown?.();
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
