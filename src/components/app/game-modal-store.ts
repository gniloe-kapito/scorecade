"use client";

import { useSyncExternalStore } from "react";

/** Крошечное глобальное состояние для компактного окна игры: любая карточка
 *  (главная, каталог, библиотека) может открыть его, не пробрасывая колбэки
 *  через пропсы. useSyncExternalStore — без зависимостей, строго синхронно. */

let openId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return openId;
}

/** Открыть компактное окно игры (id вида "steam:730"). */
export function openGameModal(gameId: string): void {
  if (!gameId) return;
  openId = gameId;
  emit();
}

/** Закрыть окно (вызывается самим окном; внешний код обычно не нужен). */
export function closeGameModal(): void {
  openId = null;
  emit();
}

/** Id игры, для которой окно открыто (null — закрыто). */
export function useGameModalId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** Обработчик клика для ссылок-карточек: модификаторы (cmd/ctrl/shift,
 *  средняя кнопка) оставляем браузеру — открывается полная страница игры. */
export function gameModalClickHandler(gameId: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return; // пусть браузер откроет ссылку как обычно
    }
    e.preventDefault();
    openGameModal(gameId);
  };
}
