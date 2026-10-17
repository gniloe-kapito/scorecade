"use client";

// Публичный список администраторов (GET /api/admins) для отметки у ников:
// красный ник + значок «Админ». Один общий запрос на страницу — никаких
// обращений на каждый ник. Кэш браузера (Cache-Control: max-age=60) и
// staleTime react-query держат нагрузку минимальной.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface AdminsResponse {
  usernames: string[];
  badgeVisible: boolean;
}

export function useAdmins() {
  const query = useQuery({
    queryKey: ["admins"],
    // no-cache: сервер отдаёт Cache-Control: max-age=60 (для гостей это
    // экономит запросы), но после переключения значка админом рефеч должен
    // сверяться с сервером, а не поднимать старый ответ из HTTP-кэша.
    queryFn: () =>
      api<AdminsResponse>("/api/admins", { cache: "no-cache" }),
    staleTime: 60_000,
    retry: 0,
  });

  // Set ников в нижнем регистре — быстрый lookup без регистра.
  const adminNames = useMemo(
    () => new Set((query.data?.usernames ?? []).map((u) => u.toLowerCase())),
    [query.data],
  );

  return {
    /** Ники администраторов (lowercase) — пустой набор, если отметка скрыта. */
    adminNames,
    /** Показывать ли значок «Админ» у ников (глобальный переключатель). */
    badgeVisible: query.data?.badgeVisible ?? true,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
