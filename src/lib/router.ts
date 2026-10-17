"use client";

import { useEffect, useState } from "react";

export interface RouteInfo {
  path: string; // '/game/steam:730'
  segments: string[]; // ['game', 'steam:730']
  query: URLSearchParams;
}

export function parseHash(hash: string): RouteInfo {
  const raw = (hash || "").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const segments = normalized
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return {
    path: normalized,
    segments,
    query: new URLSearchParams(queryPart ?? ""),
  };
}

/** Hash-based SPA router: #/game/steam:730, #/u/username, #/feed, #/me ... */
export function useHashRoute(): RouteInfo {
  const [route, setRoute] = useState<RouteInfo>(() =>
    parseHash(window.location.hash),
  );
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  window.location.hash = to;
}

/** Базовый путь сайта, известный на момент сборки: "" локально и на домене
 *  вида ИМЯ.github.io, "/ИМЯ-РЕПОЗИТОРИЯ" на GitHub Pages (подставляется
 *  релизным workflow из названия репозитория). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Абсолютная «красивая» ссылка для шаринга: origin + базовый путь + путь
 *  приложения, например https://user.github.io/scorecade/u/ник.
 *  Само приложение живёт на хеш-роутах (#/u/ник); при открытии красивой
 *  ссылки статический хостинг отдаёт 404.html (app/not-found.tsx), который
 *  мгновенно превращает путь обратно в хеш-роут. */
export function shareUrl(path: string): string {
  return `${window.location.origin}${BASE_PATH}${path}`;
}

export function backOrHome(): void {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = "#/";
}

export function loginRedirectUrl(): string {
  const from = window.location.hash || "#/";
  return `#/login?from=${encodeURIComponent(from)}`;
}

/** Широкие страницы (контейнер 1280px вместо 900px): главная, каталог,
 *  библиотека и профили (как в Steam — баннер и статы любят ширину);
 *  остальные страницы остаются компактными. */
export function isWideRoute(path: string): boolean {
  return (
    path === "/" ||
    path === "/games" ||
    path.startsWith("/games/") ||
    path === "/library" ||
    path.startsWith("/library/") ||
    path === "/me" ||
    path.startsWith("/me/") ||
    path.startsWith("/u/")
  );
}
