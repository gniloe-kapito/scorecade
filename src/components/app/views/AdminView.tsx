"use client";

// #/admin — панель администратора. Вход: обычная авторизация + isAdmin
// (таблица admins) + PIN админ-режима (те же 30 минут, что и везде).
//
// Возможности: поиск по никам, список пользователей (новые сверху) с
// датой регистрации и счётчиками, и действия над каждым — смена ника,
// смена пароля (включая свой, без старого пароля), бан/разбан и
// удаление аккаунта (все — с 10 подтверждениями). Забаненным вход
// закрыт; у админов бан/удаление/смена пароля запрещены.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  LogIn,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAdminMode } from "@/lib/admin-context";
import { useAuth } from "@/lib/auth-context";
import { useAdmins } from "@/hooks/use-admins";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SITE_NAME } from "@/lib/config";
import { formatDate, pluralRu } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "../EmptyState";
import { UserAvatar } from "../UserAvatar";
import { AdminPinDialog } from "../AdminPinDialog";
import { AdminUserActions } from "../AdminUserActions";

interface AdminUserRow {
  id: number;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  banned: boolean;
  bannedAt: string | null;
  isAdmin: boolean;
  ratings: number;
  followers: number;
  comments: number;
}

interface AdminUsersResponse {
  total: number;
  items: AdminUserRow[];
}

export function AdminView() {
  const { user, ready } = useAuth();
  const { admin, adminApi } = useAdminMode();
  const { adminNames } = useAdmins();
  const [pinOpen, setPinOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  useEffect(() => {
    document.title = `Админ-панель — ${SITE_NAME}`;
  }, []);

  // Сколько страниц показываем — относится к текущему поисковому запросу
  // (новый запрос автоматически сбрасывает на первую страницу, без эффекта).
  const [pagesByQuery, setPagesByQuery] = useState({ q: "", pages: 1 });
  const pages = pagesByQuery.q === debouncedQ ? pagesByQuery.pages : 1;
  const showMore = () => setPagesByQuery({ q: debouncedQ, pages: pages + 1 });

  const usersQuery = useQuery({
    queryKey: ["admin-users", debouncedQ, pages],
    queryFn: () =>
      adminApi(
        `/api/admin/users?q=${encodeURIComponent(debouncedQ)}&offset=0&take=${pages * 50}`,
      ) as Promise<AdminUsersResponse>,
    enabled: !!admin,
    placeholderData: (prev) => prev,
  });

  if (!ready) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-8">
        <EmptyState
          icon={LogIn}
          title="Админ-панель доступна после входа"
          hint="Войдите в аккаунт администратора, затем подтвердите PIN."
          action={
            <Button asChild>
              <a href="#/login?from=%23/admin">Войти</a>
            </Button>
          }
        />
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="py-8">
        <EmptyState
          icon={Users}
          title="Недостаточно прав"
          hint="Панель открыта только для администраторов."
          action={
            <Button asChild variant="secondary">
              <a href="#/">На главную</a>
            </Button>
          }
        />
      </div>
    );
  }

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;

  return (
    <div className="py-6 md:py-10">
      <section className="mb-7 text-center md:text-left">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold leading-tight tracking-tight md:justify-start md:text-3xl">
          <ShieldCheck className="h-7 w-7 text-amber-500" aria-hidden />
          Админ-панель
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:mx-0">
          Управление пользователями: смена ников и паролей, бан и удаление
          аккаунтов. Каждое опасное действие — с 10 подтверждениями и
          вводом ника цели; всё пишется в журнал админ-действий.
        </p>
      </section>

      {!admin ? (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
          <p className="text-sm font-bold">Админ-режим не активен</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            Введите PIN администратора (4 символа) — панель откроется на 30
            минут. Как и везде, режим сбрасывается при перезагрузке страницы.
          </p>
          <Button className="mt-4 font-bold" onClick={() => setPinOpen(true)}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Ввести PIN
          </Button>
        </section>
      ) : (
        <div className="space-y-4">
          {/* Свои действия: смена пароля без старого и своего ника. */}
          <section
            aria-label="Мой аккаунт"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar username={user.username} src={user.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">
                    Вы вошли как {user.username}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    Свой пароль можно сменить без старого — PIN уже подтверждён.
                  </p>
                </div>
              </div>
              <AdminUserActions username={user.username} isSelf />
            </div>
          </section>

          {/* Поиск и список пользователей */}
          <section
            aria-label="Пользователи"
            className="rounded-xl border border-border bg-card p-4 sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold">Пользователи</h2>
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск по нику…"
                  className="pl-9"
                  aria-label="Поиск пользователя по нику"
                  autoComplete="off"
                />
              </div>
            </div>

            {usersQuery.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
              </div>
            ) : usersQuery.isError ? (
              <div className="py-6">
                <EmptyState
                  icon={Users}
                  title="Не удалось загрузить список"
                  hint="Проверьте соединение и попробуйте ещё раз."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => void usersQuery.refetch()}
                    >
                      Повторить
                    </Button>
                  }
                />
              </div>
            ) : items.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={Search}
                  title={debouncedQ ? "Никто не найден" : "Пользователей пока нет"}
                  hint={
                    debouncedQ
                      ? `По запросу «${debouncedQ}» ничего не нашлось.`
                      : "Как только кто-то зарегистрируется, он появится здесь."
                  }
                />
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">
                  {total}{" "}
                  {pluralRu(total, "аккаунт", "аккаунта", "аккаунтов")}
                  {debouncedQ && ` по запросу «${debouncedQ}»`}
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {items.map((u) => {
                    const isSelf = u.username === user.username;
                    return (
                      <li
                        key={u.id}
                        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar username={u.username} src={u.avatarUrl} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <a
                                href={`#/u/${encodeURIComponent(u.username)}`}
                                className="truncate text-sm font-bold hover:underline"
                              >
                                {u.username}
                              </a>
                              {u.isAdmin && (
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  админ
                                </span>
                              )}
                              {u.banned && (
                                <span className="rounded-full border border-destructive/40 bg-destructive/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-destructive">
                                  забанен
                                </span>
                              )}
                              {isSelf && (
                                <span className="rounded-full border border-border bg-secondary px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                  это вы
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
                              с {formatDate(u.createdAt)} ·{" "}
                              {u.ratings}{" "}
                              {pluralRu(u.ratings, "оценка", "оценки", "оценок")} ·{" "}
                              {u.followers}{" "}
                              {pluralRu(u.followers, "подписчик", "подписчика", "подписчиков")}
                            </p>
                          </div>
                        </div>
                        <div className={cn("shrink-0", isSelf && "sm:pr-1")}>
                          <AdminUserActions
                            username={u.username}
                            isSelf={isSelf}
                            targetIsAdmin={u.isAdmin || adminNames.has(u.username.toLowerCase())}
                            banned={u.banned}
                            compact
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {items.length < total && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="secondary"
                      disabled={usersQuery.isFetching}
                      onClick={showMore}
                    >
                      {usersQuery.isFetching && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      )}
                      Показать ещё ({items.length} из {total})
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <AdminPinDialog open={pinOpen} onOpenChange={setPinOpen} />
    </div>
  );
}
