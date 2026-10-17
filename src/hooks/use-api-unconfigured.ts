"use client";

import { useSyncExternalStore } from "react";
import { isApiUnconfigured } from "@/lib/api-client";

// public/config.js грузится один раз до старта приложения и во время
// работы не меняется, поэтому подписка на изменения не нужна.
const subscribeNoop = () => () => {};

/**
 * true, если адрес API не заполнен в public/config.js, а сайт открыт
 * не на localhost. Для баннера «Бэкенд не настроен» в App.
 *
 * useSyncExternalStore (а не setState в эффекте): серверный снапшот
 * всегда false, поэтому разметка после гидратации не расходится.
 */
export function useApiUnconfigured(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    // Клиентский снапшот:
    isApiUnconfigured,
    // SSR/статическая сборка: считаем, что всё настроено.
    () => false,
  );
}
