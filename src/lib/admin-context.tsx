"use client";

// Контекст админ-режима. Состояние (короткоживущий токен + срок) живёт
// ТОЛЬКО в памяти страницы: перезагрузка = режим выключен. Токен нигде
// не сохраняется и не логируется.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ApiError, api, apiBaseUrl, getToken } from "@/lib/api-client";

export interface AdminSession {
  token: string;
  /** ISO-строка момента окончания. */
  expiresAt: string;
  /** true — используется встроенный PIN «1111» (секрет ADMIN_PIN не задан). */
  defaultPin: boolean;
}

interface AdminApiOptions {
  method?: string;
  body?: unknown;
}

interface AdminContextValue {
  admin: AdminSession | null;
  /** Вход по PIN; бросает ApiError с текстом для диалога. */
  enter: (pin: string) => Promise<void>;
  /** Выход (удаляет админ-сессию на сервере и локально). */
  exit: () => Promise<void>;
  /** api() с заголовком X-Admin-Token (для /api/admin/*).
   *  ВАЖНО: не делать эту функцию дженериком внутри useCallback —
   *  компилятор React неправильно мемоизирует такие замыкания
   *  (устаревший admin); типизация вынесена в adminRequest<T>. */
  adminApi: (path: string, opts?: AdminApiOptions) => Promise<unknown>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

/** Запрос к /api/admin/* с заголовком X-Admin-Token (дженерик — вне
 *  компонента, чтобы компилятор React не терял зависимости замыкания). */
async function adminRequest<T>(
  token: string,
  path: string,
  opts: AdminApiOptions,
  onForbidden?: () => void,
): Promise<T> {
  const headers: Record<string, string> = {
    // Обычная авторизация (Bearer) + токен короткоживущей админ-сессии:
    // requireAdmin проверяет и то, и другое.
    Authorization: `Bearer ${getToken() ?? ""}`,
    "X-Admin-Token": token,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const base = apiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
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
    // Сессия истекла или права сняли — тихо выходим из режима.
    if (res.status === 403) onForbidden?.();
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Что-то пошло не так. Попробуйте ещё раз.";
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Выход из аккаунта выключает админ-режим (render-phase sync —
  // без синхронного setState в эффекте).
  if (admin && user === null) {
    setAdmin(null);
  }

  const enter = useCallback(async (pin: string) => {
    // Ответ API: { adminToken, expiresAt, defaultPin } — в состояние
    // кладём уже с полем token (AdminSession).
    const data = await api<{
      adminToken: string;
      expiresAt: string;
      defaultPin: boolean;
    }>("/api/admin/enter", {
      method: "POST",
      body: { pin },
    });
    setAdmin({
      token: data.adminToken,
      expiresAt: data.expiresAt,
      defaultPin: data.defaultPin,
    });
  }, []);

  const exit = useCallback(async () => {
    const current = admin;
    setAdmin(null);
    if (!current) return;
    try {
      await api("/api/admin/exit", {
        method: "POST",
        headers: { "X-Admin-Token": current.token },
      });
    } catch {
      /* сессия могла истечь — это не ошибка */
    }
  }, [admin]);

  /** Мягкий выход при выходе из аккаунта (logout в auth-context чистит
   *  кэш, но админ-сессию нужно скинуть и здесь). */
  const adminApi = useCallback(
    (path: string, opts: AdminApiOptions = {}): Promise<unknown> => {
      const token = admin?.token;
      if (!token) {
        return Promise.reject(new ApiError("Админ-режим не активен.", 403));
      }
      return adminRequest<unknown>(token, path, opts, () => setAdmin(null));
    },
    [admin],
  );

  // Автовыход по истечении срока сессии (проверка раз в секунду,
  // состояние меняется только в момент истечения).
  useEffect(() => {
    if (!admin) return;
    const id = window.setInterval(() => {
      if (Date.now() >= new Date(admin.expiresAt).getTime()) {
        setAdmin(null);
        void queryClient.invalidateQueries({ queryKey: ["admins"] });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [admin, queryClient]);

  const value = useMemo(
    () => ({ admin, enter, exit, adminApi }),
    [admin, enter, exit, adminApi],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminMode(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminMode must be used inside AdminProvider");
  return ctx;
}
