"use client";

// Настройка «Анимация фона»: авто / включена / выключена.
// Значение живёт в localStorage (scorecade_motion) и применяется
// КОМПОНЕНТОМ ThemeCanvas ко всем живым темам:
//   «авто»  — следует системной настройке prefers-reduced-motion
//             (по умолчанию: система просит меньше движения — фон статичен);
//   «вкл»   — анимировать всегда, даже если система просит тишины;
//   «выкл»  — один статичный кадр: экономит батарею и спасает слабые
//             телефоны, анимация не мешает тем, кому она не нужна.

export type MotionPref = "auto" | "on" | "off";

export const MOTION_STORAGE_KEY = "scorecade_motion";

/** Событие на window: настройка изменилась (для ThemeCanvas). */
export const MOTION_CHANGE_EVENT = "scorecade-motion";

function isMotionPref(v: string | null | undefined): v is MotionPref {
  return v === "auto" || v === "on" || v === "off";
}

/** Текущее значение настройки (некорректное → «авто»). Безопасно для SSR. */
export function getMotionPref(): MotionPref {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return isMotionPref(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

/** Сохранить настройку и оповестить слушателей (ThemeCanvas перерисуется). */
export function setMotionPref(pref: MotionPref): void {
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, pref);
  } catch {
    /* storage unavailable — настройка живёт до перезагрузки */
  }
  window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT, { detail: pref }));
}

/** Разрешена ли анимация при текущей настройке и системном reduced-motion. */
export function motionAllowed(reducedMotion: boolean): boolean {
  const pref = getMotionPref();
  if (pref === "on") return true;
  if (pref === "off") return false;
  return !reducedMotion;
}

/** Подписка на изменение настройки (для useSyncExternalStore):
 *  локальное событие + синхронизация вкладок через storage. */
export function subscribeMotion(onChange: () => void): () => void {
  window.addEventListener(MOTION_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Снимок системной настройки prefers-reduced-motion. */
export function reducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Подписка на изменение prefers-reduced-motion (для useSyncExternalStore). */
export function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
