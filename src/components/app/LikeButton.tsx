"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { loginRedirectUrl } from "@/lib/router";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Like button for a review (rating with text). Optimistic toggle with
 * rollback on error; anonymous visitors are sent to the login page.
 * Own reviews render as a non-clickable counter.
 */
export function LikeButton({
  gameId,
  targetUsername,
  likeCount,
  likedByMe,
  className,
}: {
  gameId: string;
  targetUsername: string;
  likeCount: number;
  likedByMe: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwn = user?.username === targetUsername;
  const [state, setState] = useState({ count: likeCount, liked: likedByMe });
  const [pop, setPop] = useState(false);

  // Re-sync when the server data changes (refetch after staleTime).
  // "Adjust state during render" pattern — no effect needed.
  const [prevProps, setPrevProps] = useState({ likeCount, likedByMe });
  if (
    prevProps.likeCount !== likeCount ||
    prevProps.likedByMe !== likedByMe
  ) {
    setPrevProps({ likeCount, likedByMe });
    setState({ count: likeCount, liked: likedByMe });
  }

  const toggle = async () => {
    if (isOwn) return;
    if (!user) {
      window.location.href = loginRedirectUrl();
      return;
    }
    const prev = state;
    const next = { count: prev.count + (prev.liked ? -1 : 1), liked: !prev.liked };
    setState(next); // optimistic
    // Tiny arcade haptic on mobile (no-op where unsupported).
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(next.liked ? 14 : 8);
    }
    if (next.liked) {
      setPop(true);
      window.setTimeout(() => setPop(false), 350);
    }
    try {
      await api(
        next.liked
          ? `/api/ratings/${encodeURIComponent(gameId)}/like`
          : `/api/ratings/${encodeURIComponent(gameId)}/like?target=${encodeURIComponent(targetUsername)}`,
        next.liked
          ? { method: "PUT", body: { target: targetUsername } }
          : { method: "DELETE" },
      );
    } catch (err) {
      setState(prev); // rollback
      toast({
        title: "Не получилось",
        description:
          err instanceof ApiError ? err.message : "Проверьте соединение и попробуйте ещё раз.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle();
      }}
      disabled={isOwn}
      aria-pressed={state.liked}
      aria-label={
        isOwn
          ? `${state.count} ${state.count === 1 ? "лайк" : "лайков"} на вашем отзыве`
          : state.liked
            ? `Убрать лайк (сейчас ${state.count})`
            : `Лайкнуть отзыв ${targetUsername} (сейчас ${state.count})`
      }
      title={isOwn ? "Нельзя лайкнуть свой отзыв" : undefined}
      className={cn(
        "group/like inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold tabular-nums transition-all",
        isOwn
          ? "cursor-default border-border/50 bg-secondary/40 text-muted-foreground"
          : state.liked
            ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25"
            : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-200",
          state.liked && "fill-primary",
          pop && "animate-like-pop",
        )}
        aria-hidden
      />
      {state.count}
    </button>
  );
}
