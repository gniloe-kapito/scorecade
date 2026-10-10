"use client";

import {
  CornerDownRight,
  Heart,
  MessageCircle,
  MessageSquareQuote,
  Star,
  UserPlus,
} from "lucide-react";
import { timeAgo, formatDateTime } from "@/lib/format";
import { UserAvatar } from "@/components/app/UserAvatar";
import { UserLink } from "@/components/app/UserLink";
import { GameCover } from "@/components/app/GameCover";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Every event except "follower" points at a game review thread. */
type GameNotification = Exclude<NotificationItem, { type: "follower" }>;
function isGameEvent(item: NotificationItem): item is GameNotification {
  return item.type !== "follower";
}

/** One event row — shared by the bell popover (compact) and the
 *  #/notifications page (roomier). Type chip sits on the avatar's corner.
 *
 *  Navigation targets are split by meaning: the avatar goes to the actor's
 *  profile (username also opens a hover-card on desktop); the game title
 *  and cover deep-link to the game page with the relevant review thread
 *  expanded (`#/game/<id>?review=<owner>`). Follower rows link to the
 *  actor's profile. */
export function NotificationRow({
  item,
  variant = "popover",
}: {
  item: NotificationItem;
  variant?: "popover" | "page";
}) {
  const isPage = variant === "page";

  const typeChip =
    item.type === "like" ? (
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-popover"
      >
        <Heart className="h-2 w-2 fill-current" />
      </span>
    ) : item.type === "friend_rating" ? (
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-secondary text-primary ring-2 ring-popover"
      >
        <Star className="h-2 w-2 fill-current" />
      </span>
    ) : item.type === "comment" ? (
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-secondary text-primary ring-2 ring-popover"
      >
        <MessageCircle className="h-2 w-2 fill-current" />
      </span>
    ) : item.type === "reply" ? (
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-secondary text-primary ring-2 ring-popover"
      >
        <CornerDownRight className="h-2.5 w-2.5" />
      </span>
    ) : (
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground ring-2 ring-popover"
      >
        <UserPlus className="h-2 w-2" />
      </span>
    );

  const actionText =
    item.type === "like"
      ? "оценил(а) ваш отзыв"
      : item.type === "friend_rating"
        ? "оценил(а) игру"
        : item.type === "comment"
          ? "прокомментировал(а) ваш отзыв"
          : item.type === "reply"
            ? "ответил(а) на ваш комментарий"
            : "подписался(ась) на вас";

  // Game events deep-link to the game page with the relevant review
  // thread pre-expanded; follower events point at the actor's profile.
  const gameEvent = isGameEvent(item) ? item : null;
  const threadHref = gameEvent
    ? `#/game/${gameEvent.gameId}?review=${encodeURIComponent(gameEvent.reviewOwner)}`
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 transition-colors hover:bg-secondary/40",
        isPage ? "gap-3 px-3 py-3.5" : "px-3 py-2.5",
        item.isNew && "bg-primary/[0.04]",
      )}
    >
      <a
        href={`#/u/${item.actor}`}
        aria-label={`Профиль ${item.actor}`}
        className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <UserAvatar username={item.actor} src={item.actorAvatar} size="sm" />
        {typeChip}
      </a>

      <div className="min-w-0 flex-1">
        <p className={cn("leading-snug", isPage ? "text-sm" : "text-xs")}>
          <UserLink
            username={item.actor}
            className={cn("font-bold", isPage ? "text-sm" : "text-xs")}
          />{" "}
          <span className="text-muted-foreground">{actionText}</span>
        </p>

        {gameEvent && (
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1.5 font-semibold text-foreground/85",
              isPage ? "text-sm" : "text-xs",
            )}
          >
            <a
              href={`#/game/${gameEvent.gameId}?review=${encodeURIComponent(gameEvent.reviewOwner)}`}
              title={`Открыть игру ${gameEvent.gameName}`}
              className="truncate rounded-[4px] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {gameEvent.gameName}
            </a>
            {item.type === "friend_rating" && (
              <>
                <span
                  aria-label={`оценка ${item.score} из 10`}
                  className="shrink-0 rounded-md border border-primary/35 bg-primary/15 px-1.5 py-px text-[10px] font-extrabold tabular-nums text-primary"
                >
                  {item.score}
                </span>
                {item.hasReview && (
                  <span
                    title="с отзывом"
                    className="shrink-0 text-muted-foreground/70"
                  >
                    <MessageSquareQuote className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </>
            )}
          </p>
        )}

        {item.type === "comment" && (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 break-words italic",
              isPage ? "text-sm" : "text-xs",
            )}
          >
            «{item.text}»
          </p>
        )}

        {item.type === "reply" && (
          <>
            {item.replyToText && (
              <p
                className={cn(
                  "mt-0.5 truncate text-muted-foreground/70",
                  isPage ? "text-xs" : "text-[11px]",
                )}
              >
                к «{item.replyToText}»
              </p>
            )}
            <p
              className={cn(
                "mt-0.5 line-clamp-2 break-words italic",
                isPage ? "text-sm" : "text-xs",
              )}
            >
              «{item.text}»
            </p>
          </>
        )}

        <p
          className="mt-0.5 text-[10px] text-muted-foreground/80"
          title={formatDateTime(item.createdAt)}
        >
          {timeAgo(item.createdAt)}
          {item.isNew && (
            <span className="ml-1.5 inline-flex items-center gap-1 font-bold text-primary">
              <span aria-hidden className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              новое
            </span>
          )}
        </p>
      </div>

      {gameEvent && threadHref && (
        <a
          href={threadHref}
          aria-label={`Открыть игру ${gameEvent.gameName}`}
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <GameCover
            cover={gameEvent.gameCover}
            gameId={gameEvent.gameId}
            name={gameEvent.gameName}
            className={
              isPage
                ? "h-16 w-11 shrink-0 rounded-md border border-border/60"
                : "h-[52px] w-9 shrink-0 rounded-md border border-border/60"
            }
          />
        </a>
      )}
    </div>
  );
}
