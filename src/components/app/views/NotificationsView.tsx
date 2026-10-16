"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronsDown, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  NOTIFS_KEY,
  NOTIFS_PAGE_KEY,
  NOTIFS_PAGE_SIZE,
  patchSeenInfinite,
  patchSeenRegular,
} from "@/lib/notifications-cache";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { NotificationRow } from "@/components/app/NotificationRow";
import type { NotificationItem, NotificationsResponse } from "@/lib/types";
import { SITE_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

type Filter = "all" | NotificationItem["type"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "like", label: "Лайки" },
  { key: "comment", label: "Комментарии" },
  { key: "reply", label: "Ответы" },
  { key: "friend_rating", label: "Оценки друзей" },
  { key: "follower", label: "Подписчики" },
];

/** #/notifications — full notification center. Pages of 50 events are
 *  loaded on demand («Показать ещё»); the merged timeline is sorted by
 *  the server, so filters apply to everything loaded so far. */
export function NotificationsView() {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    document.title = `Уведомления — ${SITE_NAME}`;
  }, []);

  const notifsQuery = useInfiniteQuery({
    queryKey: NOTIFS_PAGE_KEY,
    queryFn: ({ pageParam }) =>
      api<NotificationsResponse>(
        `/api/me/notifications?limit=${NOTIFS_PAGE_SIZE}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled: !!user,
    staleTime: 15_000,
  });

  if (!ready) {
    return (
      <div className="py-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
        <Skeleton className="mt-6 h-16 w-full rounded-xl" />
        <Skeleton className="mt-2 h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-extrabold">Уведомления</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Войдите в аккаунт — и здесь будут лайки и комментарии к вашим
          отзывам, ответы на ваши комментарии, оценки друзей и новые
          подписчики.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <a href="#/login">Войти</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="#/register">Создать аккаунт</a>
          </Button>
        </div>
      </div>
    );
  }

  // Guard: the cache entry could hold a legacy (non-infinite) shape after
  // a hot upgrade — never trust `pages` blindly.
  const pages = notifsQuery.data?.pages;
  const items: NotificationItem[] = Array.isArray(pages)
    ? pages.flatMap((p) => p.items ?? [])
    : [];
  const newCount = Array.isArray(pages) ? (pages[0]?.newCount ?? 0) : 0;
  const hasMore = notifsQuery.hasNextPage === true;
  const filtered =
    filter === "all" ? items : items.filter((i) => i.type === filter);

  const counts: Record<Filter, number> = {
    all: items.length,
    like: items.filter((i) => i.type === "like").length,
    comment: items.filter((i) => i.type === "comment").length,
    reply: items.filter((i) => i.type === "reply").length,
    friend_rating: items.filter((i) => i.type === "friend_rating").length,
    follower: items.filter((i) => i.type === "follower").length,
  };

  const markAllSeen = async () => {
    await api("/api/me/notifications/seen", { method: "POST" });
    queryClient.setQueryData(NOTIFS_KEY, patchSeenRegular);
    queryClient.setQueryData(NOTIFS_PAGE_KEY, patchSeenInfinite);
  };

  return (
    <div className="py-6 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Уведомления</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length > 0
              ? `${counts.like} лайков · ${counts.comment} комментариев · ${counts.reply} ответов · ${counts.friend_rating} оценок друзей · ${counts.follower} подписчиков`
              : "Лайки и комментарии к вашим отзывам, ответы, оценки друзей и новые подписчики"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void markAllSeen()}
          disabled={newCount === 0 || notifsQuery.isLoading}
          className="shrink-0"
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          {newCount > 0 ? `Прочитано (${newCount})` : "Всё прочитано"}
        </Button>
      </div>

      {/* Filter chips */}
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Фильтр уведомлений">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                active
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-70">
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <section
        aria-label="Список уведомлений"
        className="mt-4 overflow-hidden rounded-xl border border-border bg-card"
      >
        {notifsQuery.isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="mt-2 h-3 w-56" />
                </div>
                <Skeleton className="h-14 w-10 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={Bell}
              className="border-transparent bg-transparent py-6"
              title={
                filter === "all" ? "Уведомлений пока нет" : "Здесь пока пусто"
              }
              hint={
                filter === "all"
                  ? "Оценивайте игры, пишите отзывы и подписывайтесь на друзей — активность появится здесь."
                  : "Попробуйте другой фильтр или загрузите больше событий."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n) => (
              <li key={n.id}>
                <NotificationRow item={n} variant="page" />
              </li>
            ))}
          </ul>
        )}

        {/* Load older events */}
        {notifsQuery.isSuccess && hasMore && (
          <div className="border-t border-border/60 p-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void notifsQuery.fetchNextPage()}
              disabled={notifsQuery.isFetchingNextPage}
            >
              {notifsQuery.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Загрузка…
                </>
              ) : (
                <>
                  <ChevronsDown className="h-4 w-4" aria-hidden />
                  Показать ещё
                </>
              )}
            </Button>
          </div>
        )}
      </section>

      {notifsQuery.isSuccess && items.length > 0 && !hasMore && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Это все события — дальше только тишина.
        </p>
      )}
    </div>
  );
}
