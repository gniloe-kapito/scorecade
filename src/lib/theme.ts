"use client";

import { useCallback, useEffect, useState } from "react";

/** Темы оформления Scorecade: четыре спокойные из референса v3
 *  (графит, бумага, слива, мох) и двенадцать живых с анимированным фоном
 *  (аврора, угли, сакура, океан, неон, космос, магма, гроза, матрица,
 *  закат, лаванда, луг — три слоя .bd-layer в globals.css
 *  с независимыми анимациями).
 *  Каждая тема — один блок семантических CSS-переменных; компоненты не
 *  знают цветов напрямую. Выбор хранится в localStorage и восстанавливается
 *  до первой отрисовки (бутстрап-скрипт в layout.tsx). */
export type ThemeId =
  | "graphite"
  | "soft"
  | "plum"
  | "moss"
  | "aurora"
  | "ember"
  | "sakura"
  | "ocean"
  | "neon"
  | "cosmos"
  | "magma"
  | "storm"
  | "matrix"
  | "sunset"
  | "lavender"
  | "meadow";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  hint: string;
  /** Три полосы свотча: акцент / панель / линия (как в референсе). */
  swatch: { bg: string; accent: string; panel: string; line: string };
  /** Тёмная тема (для синхронизации класса .dark и color-scheme). */
  dark: boolean;
  /** Живая тема — с анимированным фоном (бейдж в пикере). */
  animated?: boolean;
}

export const THEMES: readonly ThemeDef[] = [
  {
    id: "graphite",
    label: "Графит",
    hint: "тёмная тема по умолчанию: тёплый песочный акцент на графитовом фоне",
    swatch: { bg: "#191b1b", accent: "#c0a17a", panel: "#222524", line: "#3a3d39" },
    dark: true,
  },
  {
    id: "soft",
    label: "Бумага",
    hint: "мягкая светлая тема: тёплая бумага, не слепит ни днём, ни вечером",
    swatch: { bg: "#e3e0d8", accent: "#8b6844", panel: "#eeece5", line: "#cfccc2" },
    dark: false,
  },
  {
    id: "plum",
    label: "Слива",
    hint: "тёмная тема с приглушённым фиолетовым акцентом",
    swatch: { bg: "#1b191d", accent: "#b7a0c4", panel: "#27232a", line: "#443b49" },
    dark: true,
  },
  {
    id: "moss",
    label: "Мох",
    hint: "тёмная тема с зелёным акцентом шалфейного оттенка",
    swatch: { bg: "#171b18", accent: "#a7b99a", panel: "#242b26", line: "#3a463b" },
    dark: true,
  },
  {
    id: "aurora",
    label: "Аврора",
    hint: "живая тёмная тема: северное сияние плывёт по небу тремя волнами",
    swatch: { bg: "#131a1c", accent: "#82c7b0", panel: "#1a2427", line: "#31434a" },
    dark: true,
    animated: true,
  },
  {
    id: "ember",
    label: "Угли",
    hint: "живая тёмная тема: жар дышит снизу, искры всплывают",
    swatch: { bg: "#1c1613", accent: "#dba36e", panel: "#271f19", line: "#473a2f" },
    dark: true,
    animated: true,
  },
  {
    id: "sakura",
    label: "Сакура",
    hint: "живая светлая тема: розовые волны текут в разные стороны",
    swatch: { bg: "#efe7ea", accent: "#b57f93", panel: "#f6eff2", line: "#dcd0d6" },
    dark: false,
    animated: true,
  },
  {
    id: "ocean",
    label: "Океан",
    hint: "живая тёмная тема: в глубине медленно ходят лучи света",
    swatch: { bg: "#0d141a", accent: "#7cc4b8", panel: "#121c23", line: "#273a44" },
    dark: true,
    animated: true,
  },
  {
    id: "neon",
    label: "Неон",
    hint: "живая тёмная тема: синтвейв — маджента и бирюза пульсируют",
    swatch: { bg: "#12101b", accent: "#e07fc2", panel: "#191627", line: "#352d4d" },
    dark: true,
    animated: true,
  },
  {
    id: "cosmos",
    label: "Космос",
    hint: "живая тёмная тема: мерцающие звёзды и ворочающаяся туманность",
    swatch: { bg: "#0f0d18", accent: "#b3a1e0", panel: "#161320", line: "#2f2a44" },
    dark: true,
    animated: true,
  },
  {
    id: "magma",
    label: "Магма",
    hint: "живая тёмная тема: раскалённые прожилины дышат под чёрным камнем",
    swatch: { bg: "#150f0e", accent: "#e0825c", panel: "#201614", line: "#452c23" },
    dark: true,
    animated: true,
  },
  {
    id: "storm",
    label: "Гроза",
    hint: "живая тёмная тема: косой дождь и редкие вспышки молний",
    swatch: { bg: "#11141b", accent: "#8fb3d9", panel: "#181d26", line: "#2c3847" },
    dark: true,
    animated: true,
  },
  {
    id: "matrix",
    label: "Матрица",
    hint: "живая тёмная тема: зелёный цифровой дождь струится по экрану",
    swatch: { bg: "#0b110c", accent: "#7dd977", panel: "#111a13", line: "#25382a" },
    dark: true,
    animated: true,
  },
  {
    id: "sunset",
    label: "Закат",
    hint: "живая светлая тема: солнце садится в персиковое небо",
    swatch: { bg: "#f5ece4", accent: "#c97a5b", panel: "#fbf4ed", line: "#dfcec0" },
    dark: false,
    animated: true,
  },
  {
    id: "lavender",
    label: "Лаванда",
    hint: "живая светлая тема: сиреневые поля плывут в разные стороны",
    swatch: { bg: "#edeaf4", accent: "#8f7ec0", panel: "#f4f1fa", line: "#d8d2e4" },
    dark: false,
    animated: true,
  },
  {
    id: "meadow",
    label: "Луг",
    hint: "живая светлая тема: солнечные пятна ползут по зелёной поляне",
    swatch: { bg: "#e9eee2", accent: "#6f9d5c", panel: "#f0f5e9", line: "#d3ddc4" },
    dark: false,
    animated: true,
  },
];

export const THEME_STORAGE_KEY = "scorecade_theme";
export const DEFAULT_THEME: ThemeId = "graphite";

/** Разрешённые id — для бутстрап-скрипта и валидации чтения из storage. */
export const THEME_IDS: ReadonlySet<string> = new Set(
  THEMES.map((t) => t.id),
);

function isThemeId(v: string | null | undefined): v is ThemeId {
  return !!v && THEME_IDS.has(v);
}

/** Тема, сохранённая в localStorage (или дефолт). Безопасна для SSR. */
export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Применить тему: data-theme на <html>, класс .dark для утилит dark:,
 *  запись в localStorage. Светлая тема снимает .dark до отрисовки.
 *  Смена сопровождается коротким кроссфейдом цветов (.theme-switching). */
export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", id);
  root.classList.toggle("dark", THEMES.find((t) => t.id === id)?.dark ?? true);
  window.setTimeout(() => root.classList.remove("theme-switching"), 420);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* storage unavailable — тема живёт до перезагрузки */
  }
}

/** Реактивное состояние текущей темы (для пикера в настройках). */
export function useAppTheme(): [ThemeId, (id: ThemeId) => void] {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;
    // Тема уже применена бутстрап-скриптом до отрисовки; здесь лишь
    // синхронизируем состояние пикера (без каскадного рендера в эффекте).
    queueMicrotask(() => {
      if (!cancelled) setTheme(getStoredTheme());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback((id: ThemeId) => {
    applyTheme(id);
    setTheme(id);
  }, []);

  return [theme, choose];
}
