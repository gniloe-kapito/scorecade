"use client";

import { TOKEN_STORAGE_KEY } from "@/lib/config";

// Адрес бэкенда задаётся в public/config.js (window.SCORECADE_CONFIG.apiUrl),
// чтобы его можно было менять без пересборки — например, прямо на GitHub.
declare global {
  interface Window {
    SCORECADE_CONFIG?: { apiUrl?: string };
  }
}

/** База API: без хвостового слэша. Пустая строка = тот же домен (dev). */
export function apiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const raw = window.SCORECADE_CONFIG?.apiUrl;
  if (typeof raw !== "string") return "";
  const url = raw.trim();
  // Незаполненный шаблон («ВПИШИТЕ…») или не-URL считаем пустым.
  if (!url.startsWith("http://") && !url.startsWith("https://")) return "";
  return url.replace(/\/+$/, "");
}

/** true, если адрес API не настроен, а сайт открыт не на localhost.
 * На localhost пустой адрес — норма (dev-версия на одном сервере). */
export function isApiUnconfigured(): boolean {
  if (typeof window === "undefined") return false;
  if (apiBaseUrl() !== "") return false;
  return !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(window.location.host);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown; // JSON value or FormData (multipart upload)
  /** Дополнительные заголовки (например, X-Admin-Token для админ-режима). */
  headers?: Record<string, string>;
  /** Режим HTTP-кэша fetch (например, "no-cache" — сверяться с сервером). */
  cache?: RequestCache;
}

/** JSON/multipart fetch wrapper with bearer auth and friendly error messages. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const base = apiBaseUrl();
  // Незаполненный config.js на проде: без этой проверки запросы уходили бы
  // на сам GitHub Pages и молча падали в 404. Подсказываем, что настроить.
  if (base === "" && isApiUnconfigured()) {
    throw new ApiError(
      "Бэкенд не настроен: впишите адрес API в public/config.js",
      0,
    );
  }

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm =
    typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      cache: opts.cache,
      body:
        opts.body !== undefined
          ? isForm
            ? (opts.body as FormData)
            : JSON.stringify(opts.body)
          : undefined,
    });
  } catch {
    throw new ApiError("Нет соединения с сервером. Проверьте интернет.", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Что-то пошло не так. Попробуйте ещё раз.";
    throw new ApiError(message, res.status);
  }

  return data as T;
}
