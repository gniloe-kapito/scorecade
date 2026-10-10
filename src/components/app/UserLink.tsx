"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, UserRound } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatAverage, formatMonthYear } from "@/lib/format";
import { UserAvatar } from "./UserAvatar";
import { FollowButton } from "./FollowButton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UserMini } from "@/lib/types";

const OPEN_DELAY = 320; // hover → card (ms)
const FOCUS_DELAY = 550; // keyboard focus → card (ms)
const CLOSE_DELAY = 150; // pointer left → card closes (ms)
const CARD_W = 288; // w-72
const EST_CARD_H = 264; // estimated height for above/below decision

/** Hover-cards are a pointer-fine luxury — on touch devices a tap simply
 *  navigates to the profile, no floating UI. Evaluated once per page load. */
const CAN_HOVER =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches === true ||
    window.location.search.includes("debug-hover"));

interface CardPos {
  left: number;
  /** Viewport-relative placement: exactly one of top/bottom is set. */
  top?: number;
  bottom?: number;
  caretLeft: number;
  above: boolean;
}

/**
 * A `#/u/<username>` anchor with a floating mini-profile card that opens
 * after a short hover (or keyboard focus) on pointer-fine devices.
 * Tap/touch never triggers the card — the link just navigates.
 */
export function UserLink({
  username,
  children,
  className,
  wrapperClassName,
  ariaLabel,
}: {
  username: string;
  children?: ReactNode;
  /** Classes for the anchor itself (text styling, sizing). */
  className?: string;
  /** Classes for the inline wrapper (flex layout: shrink-0, self-start…). */
  wrapperClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CardPos | null>(null);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Timer cleanup on unmount (the card dies together with the link).
  useEffect(() => {
    return () => clearTimers();
     
  }, []);

  // Any scroll or hash change instantly drops the card — a floating card
  // that detaches from its anchor looks broken.
  useEffect(() => {
    if (!open) return;
    const close = () => {
      clearTimers();
      setOpen(false);
    };
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("hashchange", close);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("hashchange", close);
    };
     
  }, [open]);

  const computePos = (): CardPos => {
    const el = anchorRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = el?.getBoundingClientRect();
    if (!r) {
      return { left: 8, top: 8, caretLeft: 24, above: false };
    }
    // Prefer below the anchor; flip above when there is no room there.
    const roomBelow = vh - r.bottom;
    const above = roomBelow < EST_CARD_H && r.top >= EST_CARD_H;
    const left = Math.min(
      Math.max(r.left + r.width / 2 - CARD_W / 2, 8),
      Math.max(vw - CARD_W - 8, 8),
    );
    const caretLeft = Math.min(
      Math.max(r.left + r.width / 2 - left, 22),
      CARD_W - 22,
    );
    return above
      ? { left, bottom: vh - r.top + 10, caretLeft, above }
      : { left, top: r.bottom + 10, caretLeft, above };
  };

  const scheduleOpen = (delay: number) => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (open || openTimer.current !== null) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      setPos(computePos());
      setOpen(true);
    }, delay);
  };

  const scheduleClose = (delay: number = CLOSE_DELAY) => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, delay);
  };

  const closeNow = () => {
    clearTimers();
    setOpen(false);
  };

  // Data is fetched lazily — only when the card actually opens.
  const miniQuery = useQuery({
    queryKey: ["userMini", username.toLowerCase()],
    queryFn: () =>
      api<UserMini>(`/api/users/${encodeURIComponent(username)}/mini`),
    enabled: open,
    staleTime: 60_000,
    retry: 0,
  });

  return (
    <span
      className={cn("relative inline-flex max-w-full", wrapperClassName)}
      onMouseEnter={CAN_HOVER ? () => scheduleOpen(OPEN_DELAY) : undefined}
      onMouseLeave={CAN_HOVER ? () => scheduleClose() : undefined}
      onFocus={CAN_HOVER ? () => scheduleOpen(FOCUS_DELAY) : undefined}
      onBlur={CAN_HOVER ? () => scheduleClose(120) : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          closeNow();
        }
      }}
    >
      <a
        ref={anchorRef}
        href={`#/u/${username}`}
        aria-label={ariaLabel ?? `Профиль ${username}`}
        className={cn(
          "cursor-pointer transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
          className,
        )}
      >
        {children ?? username}
      </a>

      {/* Portal to <body>: ancestor transforms/filters (open comment threads
          keep `transform: translateY(0)` after their animation) must not
          affect the fixed-positioned card. */}
      {open &&
        pos &&
        createPortal(
          <span
            aria-label={`Карточка профиля ${username}`}
            className={cn(
              "animate-card-in fixed z-50 block w-72 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[0_18px_48px_-16px_rgba(0,0,0,0.45)] backdrop-blur-md",
              "dark:shadow-[0_18px_48px_-16px_rgba(0,0,0,0.7)]",
            )}
            style={{
              left: pos.left,
              ...(pos.top !== undefined
                ? { top: pos.top }
                : { bottom: pos.bottom }),
            }}
            onMouseEnter={() => {
              if (closeTimer.current !== null) {
                window.clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
            }}
            onMouseLeave={() => scheduleClose(80)}
          >
            {/* caret pointing at the anchor */}
            <span
              aria-hidden
              className={cn(
                "absolute h-2.5 w-2.5 rotate-45 border-border/80 bg-card",
                pos.above
                  ? "-bottom-[5px] border-b border-r"
                  : "-top-[5px] border-l border-t",
              )}
              style={{ left: pos.caretLeft - 5 }}
            />

            {miniQuery.isLoading || !miniQuery.data ? (
              <MiniCardSkeleton error={!!miniQuery.error} />
            ) : (
              <MiniCard user={miniQuery.data} />
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}

function MiniCardSkeleton({ error }: { error: boolean }) {
  if (error) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Не удалось загрузить карточку —
        <br />
        откройте профиль напрямую.
      </p>
    );
  }
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-3 h-8 w-full rounded-lg" />
    </div>
  );
}

function MiniCard({ user }: { user: UserMini }) {
  const s = user.stats;
  const cells: { value: string; label: string; accent?: boolean }[] = [
    { value: String(s.ratings), label: "оценок", accent: true },
    { value: formatAverage(s.average), label: "средняя" },
    { value: String(s.reviews), label: "отзывов" },
    { value: String(s.followers), label: "подписчиков" },
    { value: String(s.following), label: "подписок" },
    { value: String(s.wants), label: "хочу" },
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-gradient-to-br from-primary/60 to-primary/10 p-[2px]">
          <UserAvatar
            username={user.username}
            src={user.avatarUrl}
            size="lg"
            className="border-2 border-card"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-base font-extrabold leading-tight">
              {user.username}
            </span>
            {user.isMe && (
              <span className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">
                это вы
              </span>
            )}
          </span>
          <span
            className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"
            title={`В Scorecade с ${formatMonthYear(user.createdAt)}`}
          >
            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
            с {formatMonthYear(user.createdAt)}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {cells.map((c) => (
          <span
            key={c.label}
            className="rounded-lg border border-border/60 bg-secondary/30 px-1.5 py-1 text-center"
          >
            <span
              className={cn(
                "block text-sm font-extrabold leading-tight tabular-nums",
                c.accent && "text-primary",
              )}
            >
              {c.value}
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {c.label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {!user.isMe ? (
          <FollowButton
            username={user.username}
            initialFollowing={user.isFollowing}
            size="sm"
            className="flex-1"
          />
        ) : (
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1.5 text-xs font-bold text-primary">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Ваш профиль
          </span>
        )}
        <a
          href={`#/u/${user.username}`}
          className="flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-xs font-bold text-foreground/90 transition-colors hover:border-primary/40 hover:text-primary"
        >
          Профиль
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </>
  );
}
