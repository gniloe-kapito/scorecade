"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CornerDownRight,
  Loader2,
  MessageCircle,
  SendHorizonal,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { loginRedirectUrl } from "@/lib/router";
import { timeAgo, formatDateTime } from "@/lib/format";
import { UserAvatar } from "@/components/app/UserAvatar";
import { UserLink } from "@/components/app/UserLink";
import { LikeButton } from "@/components/app/LikeButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { CommentsResponse, ReviewCommentRow } from "@/lib/types";

/**
 * Action row under a review (rating with text): the like pill plus a
 * comments pill that expands into an inline thread with a composer.
 * Used on the game page (friends + community), in the feed, and on
 * profiles — anywhere reviews are shown.
 */
export function ReviewActions({
  gameId,
  targetUsername,
  likeCount,
  likedByMe,
  commentCount,
  initialOpen = false,
  className,
}: {
  gameId: string;
  targetUsername: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  /** Start with the thread expanded (deep link `#/game/<id>?review=<user>`). */
  initialOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(initialOpen);

  // Re-sync the counter when the server data changes (refetch).
  // "Adjust state during render" pattern — no effect needed.
  const [count, setCount] = useState(commentCount);
  const [prevCount, setPrevCount] = useState(commentCount);
  if (prevCount !== commentCount) {
    setPrevCount(commentCount);
    setCount(commentCount);
  }

  return (
    <div className={cn("mt-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <LikeButton
          gameId={gameId}
          targetUsername={targetUsername}
          likeCount={likeCount}
          likedByMe={likedByMe}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-controls={`comments-${targetUsername}-${gameId.replace(/[:]/g, "")}`}
          aria-label={`Комментарии к отзыву ${targetUsername}: ${count}`}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold tabular-nums transition-all",
            open
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <MessageCircle
            className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "scale-110")}
            aria-hidden
          />
          {count}
        </button>
      </div>

      {open && (
        <CommentsPanel
          gameId={gameId}
          targetUsername={targetUsername}
          onAdded={() => setCount((c) => c + 1)}
          onRemoved={() => setCount((c) => Math.max(0, c - 1))}
        />
      )}
    </div>
  );
}

/** Compute the top-level root id of a comment (walks the parent chain;
 *  guards against missing parents beyond the take limit and cycles). */
function rootIdOf(item: ReviewCommentRow, byId: Map<number, ReviewCommentRow>): number {
  let cur = item;
  for (let depth = 0; depth < 16; depth++) {
    if (cur.replyToId === null) return cur.id;
    const parent = byId.get(cur.replyToId);
    if (!parent) return cur.id; // parent not in the loaded page → top level
    cur = parent;
  }
  return cur.id; // cycle guard: treat as top level
}

/** Expandable comment thread + composer for one review.
 *  Replies nest one level under their top-level comment. */
function CommentsPanel({
  gameId,
  targetUsername,
  onAdded,
  onRemoved,
}: {
  gameId: string;
  targetUsername: string;
  onAdded: () => void;
  onRemoved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // Reply target: the comment we answer to (id + author for the chip).
  const [replyTo, setReplyTo] = useState<{ id: number; username: string } | null>(null);

  const commentsQuery = useQuery({
    queryKey: ["comments", gameId, targetUsername],
    queryFn: () =>
      api<CommentsResponse>(
        `/api/ratings/${encodeURIComponent(gameId)}/comments?target=${encodeURIComponent(targetUsername)}`,
      ),
    staleTime: 15_000,
    retry: false,
  });

  const patchItems = (
    patch: (items: ReviewCommentRow[]) => ReviewCommentRow[],
  ) => {
    queryClient.setQueryData<CommentsResponse>(
      ["comments", gameId, targetUsername],
      (old) => (old ? { items: patch(old.items) } : old),
    );
  };

  const submit = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      const created = await api<ReviewCommentRow>(
        `/api/ratings/${encodeURIComponent(gameId)}/comments`,
        {
          method: "POST",
          body: {
            target: targetUsername,
            text: clean,
            ...(replyTo ? { replyTo: replyTo.id } : {}),
          },
        },
      );
      patchItems((items) => [...items, created]);
      setText("");
      setReplyTo(null);
      onAdded();
    } catch (err) {
      toast({
        title: "Не получилось",
        description:
          err instanceof ApiError
            ? err.message
            : "Проверьте соединение и попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api(
        `/api/ratings/${encodeURIComponent(gameId)}/comments?id=${id}`,
        { method: "DELETE" },
      );
      patchItems((items) =>
        items
          .filter((c) => c.id !== id)
          // Orphaned replies (their parent is gone) lift to top level.
          .map((c) => (c.replyToId === id ? { ...c, replyToId: null, replyToAuthor: null } : c)),
      );
      if (replyTo?.id === id) setReplyTo(null);
      onRemoved();
    } catch (err) {
      toast({
        title: "Не получилось",
        description:
          err instanceof ApiError
            ? err.message
            : "Проверьте соединение и попробуйте ещё раз.",
        variant: "destructive",
      });
    }
  };

  // Group comments into top-level entries with nested replies (1 level).
  const { roots, repliesOf } = useMemo(() => {
    const items = commentsQuery.data?.items ?? [];
    const byId = new Map(items.map((c) => [c.id, c]));
    const rootSet = new Set<number>();
    const repliesMap = new Map<number, ReviewCommentRow[]>();
    for (const c of items) {
      const root = rootIdOf(c, byId);
      if (root === c.id) {
        rootSet.add(c.id);
      } else {
        const list = repliesMap.get(root) ?? [];
        list.push(c);
        repliesMap.set(root, list);
      }
    }
    // Top-level comments in chronological order; replies too.
    const rootList = items.filter((c) => rootSet.has(c.id));
    for (const list of repliesMap.values()) {
      list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    }
    return { roots: rootList, repliesOf: repliesMap };
  }, [commentsQuery.data]);

  return (
    <div
      id={`comments-${targetUsername}-${gameId.replace(/[:]/g, "")}`}
      className="animate-comment-in mt-2 rounded-xl border border-border/60 bg-secondary/25 p-3"
    >
      {commentsQuery.isLoading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ) : commentsQuery.error ? (
        <p className="text-xs text-destructive">
          {commentsQuery.error.message}
        </p>
      ) : roots.length === 0 && !user ? (
        <p className="py-1 text-xs text-muted-foreground">
          Комментариев пока нет.{" "}
          <a
            href={loginRedirectUrl()}
            className="font-bold text-primary transition-colors hover:text-primary/80"
          >
            Войдите
          </a>
          , чтобы написать первый!
        </p>
      ) : roots.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">
          Комментариев пока нет — напишите первый!
        </p>
      ) : (
        <ul className="space-y-2.5">
          {roots.map((c) => {
            const replies = repliesOf.get(c.id) ?? [];
            return (
              <li key={c.id} className="space-y-1.5">
                <CommentRow
                  c={c}
                  onReply={user ? (id, username) => setReplyTo({ id, username }) : undefined}
                  onRemove={c.isMine ? remove : undefined}
                  isReply={false}
                />
                {replies.length > 0 && (
                  <ul
                    className="ml-3.5 space-y-1.5 border-l-2 border-primary/15 pl-2.5 sm:ml-4 sm:pl-3"
                    aria-label="Ответы"
                  >
                    {replies.map((r) => (
                      <li key={r.id}>
                        <CommentRow
                          c={r}
                          onReply={user ? (id, username) => setReplyTo({ id, username }) : undefined}
                          onRemove={r.isMine ? remove : undefined}
                          isReply
                          showReplyTo={r.replyToId !== c.id ? r.replyToAuthor : null}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Composer */}
      {user ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-1.5 pt-2.5"
        >
          {replyTo && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex min-w-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] font-bold text-primary"
              >
                <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">
                  Ответ для {replyTo.username}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Отменить ответ"
                  title="Отменить ответ"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder={
                replyTo ? `Ответ ${replyTo.username}…` : "Написать комментарий…"
              }
              aria-label={
                replyTo
                  ? `Ответ на комментарий ${replyTo.username}`
                  : `Комментарий к отзыву ${targetUsername}`
              }
              className="h-8 min-w-0 flex-1 rounded-full border border-border/60 bg-background/60 px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label={replyTo ? "Отправить ответ" : "Отправить комментарий"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary transition-all hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <SendHorizonal className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </div>
        </form>
      ) : (
        <p className="pt-2 text-xs text-muted-foreground">
          <a
            href={loginRedirectUrl()}
            className="font-bold text-primary transition-colors hover:text-primary/80"
          >
            Войдите
          </a>
          , чтобы комментировать отзывы.
        </p>
      )}
    </div>
  );
}

/** One comment line (top-level or nested reply). */
function CommentRow({
  c,
  onReply,
  onRemove,
  isReply,
  showReplyTo,
}: {
  c: ReviewCommentRow;
  onReply?: (id: number, username: string) => void;
  onRemove?: (id: number) => void;
  isReply: boolean;
  /** When a reply answers another reply in the same group — show its author. */
  showReplyTo?: string | null;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2",
        isReply && "rounded-lg p-1 -mx-1 transition-colors hover:bg-background/40",
      )}
    >
      <a
        href={`#/u/${c.username}`}
        className={cn("shrink-0 pt-px", isReply && "pt-0.5")}
        aria-label={`Профиль ${c.username}`}
      >
        <UserAvatar
          username={c.username}
          src={c.avatarUrl}
          size="sm"
          className={cn("text-[10px]", isReply ? "h-5 w-5 text-[9px]" : "h-6 w-6")}
        />
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug">
          <UserLink
            username={c.username}
            className="font-bold"
          />{" "}
          {isReply && showReplyTo && (
            <span className="text-muted-foreground/70">
              → {showReplyTo}{" "}
            </span>
          )}
          <span
            className="text-muted-foreground/80"
            title={formatDateTime(c.createdAt)}
          >
            {timeAgo(c.createdAt)}
          </span>
        </p>
        <p
          className={cn(
            "mt-0.5 break-words leading-relaxed text-foreground/80",
            isReply ? "text-[13px]" : "text-sm",
          )}
        >
          {c.text}
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          {onReply && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReply(c.id, c.username);
              }}
              aria-label={`Ответить на комментарий ${c.username}`}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary"
            >
              Ответить
            </button>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onRemove(c.id);
          }}
          aria-label="Удалить свой комментарий"
          title="Удалить комментарий"
          className="shrink-0 rounded-md p-1 text-muted-foreground/60 opacity-70 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
