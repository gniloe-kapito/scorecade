"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity, LogIn, Newspaper, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { loginRedirectUrl } from "@/lib/router";
import { timeAgo, formatDateTime } from "@/lib/format";
import { SITE_NAME } from "@/lib/config";
import { GameCover } from "@/components/app/GameCover";
import { ScoreBadge } from "@/components/app/ScoreBadge";
import { ReviewActions } from "@/components/app/ReviewActions";
import { UserAvatar } from "@/components/app/UserAvatar";
import { UserLink } from "@/components/app/UserLink";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import type { FeedItem } from "@/lib/types";

export function FeedView() {
  const { user, ready } = useAuth();

  useEffect(() => {
    document.title = `Лента — ${SITE_NAME}`;
  }, []);

  if (!ready) {
    return (
      <div className="py-6">
        <ListSkeleton count={5} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-8">
        <EmptyState
          icon={LogIn}
          title="Лента оценок друзей"
          hint="Войдите в аккаунт — и здесь появятся последние оценки тех, на кого вы подписаны."
          action={
            <Button asChild>
              <a href={loginRedirectUrl()}>
                <LogIn className="h-4 w-4" aria-hidden /> Войти
              </a>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity className="h-6 w-6 text-primary" aria-hidden />
          Лента
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Последние оценки тех, на кого вы подписаны
        </p>
      </header>
      <FriendsFeed />
    </div>
  );
}

/** Лента оценок друзей: бесконечная прокрутка, без заголовка страницы.
 *  Используется и отдельной страницей #/feed, и вкладкой «Друзья» в профиле. */
export function FriendsFeed() {
  const { user } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const feedQuery = useInfiniteQuery({
    queryKey: ["feed"],
    enabled: !!user,
    queryFn: ({ pageParam }) =>
      api<{ items: FeedItem[]; nextCursor: string | null }>(
        pageParam ? `/api/feed?cursor=${pageParam}` : "/api/feed",
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          feedQuery.hasNextPage &&
          !feedQuery.isFetchingNextPage
        ) {
          void feedQuery.fetchNextPage();
        }
      },
      { rootMargin: "500px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [
    feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage,
    feedQuery.fetchNextPage,
  ]);

  const items = feedQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const hasNextPage = feedQuery.hasNextPage;

  if (feedQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card px-4">
        <ListSkeleton count={5} />
      </div>
    );
  }
  if (feedQuery.error) {
    return (
      <EmptyState
        icon={Newspaper}
        title="Не удалось загрузить ленту"
        hint={feedQuery.error.message}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => feedQuery.refetch()}
          >
            Повторить
          </Button>
        }
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Пока пусто"
        hint="Подпишитесь на друзей — их оценки появятся здесь. Найти людей можно поиском на главной или на страницах игр в блоке «Оценки друзей»."
        action={
          <Button asChild size="sm">
            <a href="#/">На главную</a>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((item) => (
          <FeedCard key={`${item.username}-${item.gameId}`} item={item} />
        ))}
      </ul>

      {/* infinite scroll sentinel */}
      <div ref={sentinelRef} aria-hidden className="h-1" />
      {feedQuery.isFetchingNextPage && (
        <div className="mt-3 rounded-lg border border-border bg-card px-4">
          <ListSkeleton count={2} />
        </div>
      )}
      {!hasNextPage && (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Вы всё посмотрели
        </p>
      )}
    </>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <li className="group rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-[var(--line-strong)]">
      <div className="flex items-stretch gap-3">
        <a href={`#/u/${item.username}`} className="shrink-0 self-start">
          <UserAvatar username={item.username} src={item.avatarUrl} size="md" />
        </a>
        <div className="min-w-0 flex-1">
          <p className="mt-1 break-words text-sm leading-snug">
            <UserLink username={item.username} className="font-bold" />{" "}
            <span className="text-muted-foreground">оценил(а)</span>{" "}
            <ScoreBadge score={item.score} size="sm" className="-translate-y-px" />{" "}
            <a
              href={`#/game/${item.gameId}`}
              className="font-bold hover:text-primary"
            >
              {item.gameName}
            </a>
          </p>
          <p
            className="mt-1 text-xs text-muted-foreground"
            title={formatDateTime(item.updatedAt)}
          >
            {timeAgo(item.updatedAt)}
          </p>
          {item.review && (
            <div className="mt-2 rounded-md border-l-2 border-primary/40 bg-secondary/40 px-3 py-2">
              <p className="break-words text-sm leading-relaxed text-foreground/80">
                {item.review}
              </p>
              <ReviewActions
                gameId={item.gameId}
                targetUsername={item.username}
                likeCount={item.likeCount}
                likedByMe={item.likedByMe}
                commentCount={item.commentCount}
                className="mt-1.5"
              />
            </div>
          )}
        </div>
        <a
          href={`#/game/${item.gameId}`}
          className="shrink-0 self-center"
          aria-label={`Открыть игру ${item.gameName}`}
        >
          <GameCover
            cover={item.gameCover}
            gameId={item.gameId}
            name={item.gameName}
            className="h-[72px] w-12 rounded-md border border-border transition-transform duration-200 group-hover:scale-[1.04]"
          />
        </a>
      </div>
    </li>
  );
}
