"use client";

import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  NOTIFS_KEY,
  NOTIFS_PAGE_KEY,
  patchSeenInfinite,
  patchSeenRegular,
} from "@/lib/notifications-cache";
import { NotificationRow } from "@/components/app/NotificationRow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NotificationsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BADGE = 99;
const NOTIFS_POPOVER_LIMIT = 15;

/** Bell in the header: likes/comments/replies on my reviews & comments
 *  + friend ratings + new followers. Polls every minute; opening the
 *  panel marks everything as seen. */
export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const markTimer = useRef<number | null>(null);

  const notifsQuery = useQuery({
    queryKey: NOTIFS_KEY,
    queryFn: () =>
      api<NotificationsResponse>(
        `/api/me/notifications?limit=${NOTIFS_POPOVER_LIMIT}`,
      ),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  if (!user) return null;

  const newCount = notifsQuery.data?.newCount ?? 0;
  const items = notifsQuery.data?.items ?? [];

  const markSeen = () => {
    // Small delay so the badge is visible while the panel animates in.
    markTimer.current = window.setTimeout(() => {
      void api("/api/me/notifications/seen", { method: "POST" }).then(() => {
        // The page keeps its own cache entry (infinite query) — patch both.
        queryClient.setQueryData(NOTIFS_KEY, patchSeenRegular);
        queryClient.setQueryData(NOTIFS_PAGE_KEY, patchSeenInfinite);
      });
    }, 900);
  };

  const cancelMark = () => {
    if (markTimer.current !== null) {
      window.clearTimeout(markTimer.current);
      markTimer.current = null;
    }
  };

  return (
    <Popover onOpenChange={(open) => (open ? markSeen() : cancelMark())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            newCount > 0
              ? `Уведомления: ${newCount} новых`
              : "Уведомления: лайки, комментарии и ответы, оценки друзей, подписчики"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {newCount > 0 && (
            <span
              aria-hidden
              className={cn(
                "absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full",
                "bg-primary px-1 text-[10px] font-extrabold tabular-nums text-primary-foreground",
                "animate-like-pop shadow-[0_0_10px_var(--primary)]",
              )}
            >
              {newCount > MAX_BADGE ? `${MAX_BADGE}+` : newCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[330px] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Уведомления
          </p>
          {newCount > 0 && (
            <p className="text-[10px] font-bold text-primary tabular-nums">
              {newCount} новых
            </p>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifsQuery.isLoading ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Загрузка…
            </p>
          ) : items.length === 0 ? (
            <div className="px-4 py-7 text-center">
              <Bell
                className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Пока тихо. Лайки, комментарии и ответы, оценки
                <br />друзей и новые подписчики появятся здесь.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow item={n} variant="popover" />
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <a
            href="#/notifications"
            className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            Все уведомления
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
