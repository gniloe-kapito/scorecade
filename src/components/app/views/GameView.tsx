"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Command,
  ExternalLink,
  Gamepad2,
  Landmark,
  Languages,
  Loader2,
  LogIn,
  MessageSquareText,
  Monitor,
  Share2,
  Sparkles,
  SquareTerminal,
  Star,
  Tag,
  Trash2,
  TriangleAlert,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { backOrHome, loginRedirectUrl, shareUrl, useHashRoute } from "@/lib/router";
import { metacriticTone, timeAgo, formatDateTime, formatAverage, formatCountCompact, pluralRu } from "@/lib/format";
import { MAX_REVIEW_LENGTH, SITE_NAME } from "@/lib/config";
import { ScorePicker } from "@/components/app/ScorePicker";
import { StatusPicker } from "@/components/app/StatusPicker";
import { GameCover } from "@/components/app/GameCover";
import { ScoreBadge } from "@/components/app/ScoreBadge";
import { LikeButton } from "@/components/app/LikeButton";
import { ReviewActions } from "@/components/app/ReviewActions";
import { UserLink } from "@/components/app/UserLink";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionTitle } from "@/components/app/SectionTitle";
import { GamePageSkeleton, ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CommunityResponse,
  FriendRating,
  Game,
  GameCategory,
  GameStatusValue,
  RatingRow,
  StatusRow,
} from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

let purifyHookAdded = false;

type IconProps = { className?: string; "aria-hidden"?: boolean | "true" };

function sanitizeDescription(html: string): string {
  if (typeof window === "undefined") return "";
  if (!purifyHookAdded) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    purifyHookAdded = true;
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "b", "i", "u", "s",
      "ul", "ol", "li", "h2", "h3", "a", "img",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "rel", "target"],
  });
}

/** Client-side pass over server-sanitized requirements HTML (defence in depth). */
function sanitizeRequirements(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["br", "strong", "em", "b", "i", "u", "s", "ul", "ol", "li"],
    ALLOWED_ATTR: [],
  });
}

const numberFmt = new Intl.NumberFormat("ru-RU");

type SaveState = "idle" | "saving" | "saved" | "error" | "anon";

export function GameView({ id }: { id: string }) {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const route = useHashRoute();

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => api<Game>(`/api/games/${encodeURIComponent(id)}`),
    staleTime: Infinity,
    retry: 1,
  });

  const ratingsQuery = useQuery({
    queryKey: ["myRatings"],
    queryFn: () => api<{ ratings: RatingRow[] }>("/api/me/ratings"),
    enabled: !!user,
    staleTime: Infinity,
  });

  const statusesQuery = useQuery({
    queryKey: ["myStatuses"],
    queryFn: () => api<{ statuses: StatusRow[] }>("/api/me/statuses"),
    enabled: !!user,
    staleTime: Infinity,
  });

  // Текущий онлайн — официальный Web API Valve; живая цифра на странице игры.
  const onlineQuery = useQuery({
    queryKey: ["online", id],
    queryFn: () =>
      api<{ players: number | null }>(
        `/api/games/online?id=${encodeURIComponent(id)}`,
      ),
    staleTime: 60_000,
    retry: 0,
  });

  const game = gameQuery.data;
  const ratings = ratingsQuery.data?.ratings ?? [];
  const statuses = statusesQuery.data?.statuses ?? [];
  const myRating = useMemo(
    () => ratings.find((r) => r.gameId === id) ?? null,
    [ratings, id],
  );
  const myStatus = useMemo(
    () => statuses.find((s) => s.gameId === id)?.status ?? null,
    [statuses, id],
  );

  // ---- rating dialog state ----
  const [ratingOpen, setRatingOpen] = useState(false);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewTouched, setReviewTouched] = useState(false);

  // ---- «Изменить оценку» deep link: #/game/<id>?rate=1 ----
  // "Adjust state during render" — React Compiler forbids setState/effects here.
  const [rateHandled, setRateHandled] = useState(false);
  if (
    !rateHandled &&
    route.query.get("rate") === "1" &&
    game &&
    user &&
    !ratingOpen
  ) {
    setRateHandled(true);
    setRatingOpen(true);
  }
  if (route.query.get("rate") !== "1" && rateHandled) {
    setRateHandled(false); // link can be re-clicked later
  }

  // ---- review-thread deep link: #/game/<id>?review=<username> ----
  // Opens that user's review with its comment thread expanded (friend and
  // community lists below both honor it; the list scrolls the row into view).
  const reviewFocus = route.query.get("review")?.toLowerCase() ?? null;

  // ---- status confirm («Не играл» with an existing rating) ----
  const [confirmNoneOpen, setConfirmNoneOpen] = useState(false);

  // Sync the review draft with the persisted rating once per game (React
  // render-phase sync pattern — never clobbers user edits, no refetch races)
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (myRating && syncedFor !== id) {
    setSyncedFor(id);
    if (!reviewTouched) {
      setReviewDraft(myRating.review ?? "");
      setReviewOpen(!!myRating.review);
    }
  }

  useEffect(() => {
    if (game) document.title = `${game.name} — ${SITE_NAME}`;
  }, [game]);

  /** Mirror a status into the ["myStatuses"] cache. */
  const patchStatusCache = useCallback(
    (next: GameStatusValue | null) => {
      queryClient.setQueryData<{ statuses: StatusRow[] }>(
        ["myStatuses"],
        (old) => {
          const base = old?.statuses ?? [];
          if (next === null) {
            return { statuses: base.filter((s) => s.gameId !== id) };
          }
          const row: StatusRow = {
            gameId: id,
            status: next,
            updatedAt: new Date().toISOString(),
          };
          const idx = base.findIndex((s) => s.gameId === id);
          if (idx === -1) return { statuses: [row, ...base] };
          const arr = [...base];
          arr[idx] = row;
          return { statuses: arr };
        },
      );
    },
    [queryClient, id],
  );

  const persist = useCallback(
    async (score: number, review: string | null) => {
      if (!user || !game) {
        if (!user) setSaveState("anon");
        return;
      }
      setSaveState("saving");
      try {
        await api(`/api/ratings/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: {
            score,
            review,
            game_name: game.name,
            game_cover: game.cover,
          },
        });
        queryClient.setQueryData<{ ratings: RatingRow[] }>(
          ["myRatings"],
          (old) => {
            const base = old?.ratings ?? [];
            const row: RatingRow = {
              gameId: id,
              gameName: game.name,
              gameCover: game.cover,
              score,
              review,
              updatedAt: new Date().toISOString(),
            };
            const idx = base.findIndex((r) => r.gameId === id);
            if (idx === -1) return { ratings: [row, ...base] };
            const next = [...base];
            next[idx] = row;
            return { ratings: next };
          },
        );
        // Rating implies «Играл» — the backend does the same, mirror the cache.
        patchStatusCache("played");
        void queryClient.invalidateQueries({ queryKey: ["community", id] });
        void queryClient.invalidateQueries({ queryKey: ["communityTop"] });
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Не удалось сохранить оценку",
        );
      }
    },
    [user, game, id, queryClient, patchStatusCache],
  );

  // "saved" indicator fades back to idle
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2600);
    return () => clearTimeout(t);
  }, [saveState]);

  const handleScoreChange = useCallback((n: number) => {
    setLiveScore(n);
  }, []);

  // The score currently selected in the dialog (button grid), falling
  // back to the persisted score. null = not chosen yet.
  const selectedScore: number | null = liveScore ?? myRating?.score ?? null;

  /** Explicit save — the picker never saves on its own (customer rule). */
  const submitScore = useCallback(() => {
    if (selectedScore === null) return;
    void persist(selectedScore, reviewDraft.trim() ? reviewDraft.trim() : null);
  }, [persist, selectedScore, reviewDraft]);

  // Review auto-save: debounced inside the change handler (no effect needed)
  const reviewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reviewDebounceRef.current) clearTimeout(reviewDebounceRef.current);
    },
    [],
  );

  const handleReviewChange = (value: string) => {
    setReviewTouched(true);
    const trimmed = value.slice(0, MAX_REVIEW_LENGTH);
    setReviewDraft(trimmed);
    if (reviewDebounceRef.current) clearTimeout(reviewDebounceRef.current);
    reviewDebounceRef.current = setTimeout(() => {
      reviewDebounceRef.current = null;
      if (user && myRating) {
        void persist(myRating.score, trimmed.trim() ? trimmed.trim() : null);
      }
    }, 800);
  };

  const removeRating = useCallback(async () => {
    try {
      await api(`/api/ratings/${encodeURIComponent(id)}`, { method: "DELETE" });
      queryClient.setQueryData<{ ratings: RatingRow[] }>(["myRatings"], (old) =>
        old ? { ratings: old.ratings.filter((r) => r.gameId !== id) } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["community", id] });
      void queryClient.invalidateQueries({ queryKey: ["communityTop"] });
      setSaveState("idle");
      setLiveScore(null);
      setReviewDraft("");
      setReviewOpen(false);
      setReviewTouched(false);
      setSyncedFor(null);
      toast("Оценка убрана");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не получилось убрать оценку",
      );
    }
  }, [id, queryClient]);

  // ---- statuses: «Играю» / «Пройдена» / «Брошена» / «Играл(а)» / «Хочу сыграть» ----
  const applyStatus = useCallback(
    async (next: GameStatusValue | "none", silentToast = false) => {
      if (!user || !game) {
        window.location.hash = loginRedirectUrl();
        return;
      }
      try {
        await api(`/api/status/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: {
            status: next,
            game_name: game.name,
            game_cover: game.cover,
          },
        });
        patchStatusCache(next === "none" ? null : next);
        void queryClient.invalidateQueries({ queryKey: ["community", id] });
        void queryClient.invalidateQueries({ queryKey: ["profile"] });
        void queryClient.invalidateQueries({ queryKey: ["library"] });
        if (!silentToast) {
          if (next === "none") toast("Отметка снята");
          else toast(`Отмечено: «${STATUS_LABELS[next]}»`);
        }
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось сохранить отметку",
        );
      }
    },
    [user, game, id, queryClient, patchStatusCache],
  );

  const pickStatus = useCallback(
    (next: GameStatusValue | "none") => {
      // Снятие отметки вместе с оценкой — это сброс: спросим перед удалением.
      if (next === "none" && myRating) {
        setConfirmNoneOpen(true);
        return;
      }
      void applyStatus(next);
    },
    [myRating, applyStatus],
  );

  const confirmNotPlayed = useCallback(async () => {
    setConfirmNoneOpen(false);
    await removeRating();
    await applyStatus("none", true);
    toast("Отметка снята (оценка удалена)");
  }, [removeRating, applyStatus]);

  // ---- chrome: scrolled top bar ----
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---- share ----
  const shareGame = useCallback(async () => {
    if (!game) return;
    // Canonical game URL — never depend on the current hash. shareUrl()
    // adds the base path so the link works on GitHub Pages project sites.
    const url = shareUrl(`/game/${encodeURIComponent(id)}`);
    const data = {
      title: `${game.name} — ${SITE_NAME}`,
      text: `${game.name} в ${SITE_NAME}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Ссылка скопирована");
    } catch {
      /* user dismissed the share sheet — not an error */
    }
  }, [game, id]);

  // ---- render ----
  if (gameQuery.isLoading) {
    return (
      <div className="py-4">
        <GamePageSkeleton />
      </div>
    );
  }

  if (gameQuery.error || !game) {
    return (
      <div className="py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={backOrHome}
          className="mb-6 -ml-2 text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Назад
        </Button>
        <EmptyState
          icon={TriangleAlert}
          title={gameQuery.error?.message ?? "Игра не найдена"}
          hint="Возможно, это DLC или игра недоступна в Steam. Попробуйте поискать другую."
          action={
            <Button asChild variant="secondary">
              <a href="#/">К поиску</a>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Top bar — portaled to body: fixed positioning must not be affected
          by the transform-based view-in animation on the wrapper */}
      {createPortal(
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-30 transition-all duration-200",
          scrolled
            ? "border-b border-border bg-background/85 backdrop-blur-md"
            : "bg-gradient-to-b from-background/70 to-transparent",
        )}
      >
        <div className="mx-auto flex h-12 w-full max-w-[900px] items-center justify-between gap-2 px-4">
          <button
            type="button"
            onClick={backOrHome}
            aria-label="Назад"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground backdrop-blur-sm transition-colors hover:border-primary/50"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p
            aria-hidden
            className={cn(
              "min-w-0 flex-1 truncate text-center text-sm font-bold transition-opacity duration-200",
              scrolled ? "opacity-100" : "opacity-0",
            )}
          >
            {game.name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void shareGame()}
              aria-label="Поделиться игрой"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
            <a
              href={game.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Открыть в Steam"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>,
      document.body,
      )}

      {/* Hero */}
      <Hero game={game} />

      {/* Rating + status bar (Kinopoisk-style: star button next to Metacritic) */}
      <section aria-label="Ваша оценка и статус" className="mb-5">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {game.metacritic !== null && (
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-1 text-xs font-extrabold tabular-nums",
                    metacriticTone(game.metacritic),
                  )}
                  title="Оценка Metacritic"
                >
                  MC {game.metacritic}
                </span>
              )}
              <button
                type="button"
                onClick={() => setRatingOpen(true)}
                aria-label={
                  myRating
                    ? `Ваша оценка: ${myRating.score} из 10 — изменить`
                    : "Поставить оценку"
                }
                className={cn(
                  "group flex items-center gap-2 rounded-md border px-3 py-2 transition-colors active:scale-[0.98]",
                  myRating
                    ? "border-primary/50 bg-[var(--primary-soft)] hover:border-primary"
                    : "border-primary/40 hover:border-primary/70 hover:bg-[var(--primary-soft)]",
                )}
              >
                <Star
                  className={cn(
                    "h-5 w-5",
                    myRating ? "fill-primary text-primary" : "text-primary",
                  )}
                  aria-hidden
                />
                {myRating ? (
                  <>
                    <span className="text-xl font-extrabold leading-none tabular-nums text-primary">
                      {myRating.score}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                      изменить
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-primary">
                    Поставить оценку
                  </span>
                )}
              </button>
              {myStatus ? (
                <span className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {STATUS_LABELS[myStatus]}
                </span>
              ) : null}
            </div>
          </div>
          {/* Отметка игрока — отдельными кнопками (референс v3) */}
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Твоя отметка
            </p>
            <StatusPicker
              value={myStatus}
              onChange={pickStatus}
              onClear={() => pickStatus("none")}
            />
          </div>
        </div>
      </section>

      {/* Meta card */}
      <section aria-label="Информация об игре" className="mb-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {onlineQuery.data?.players != null && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--good)]/45 bg-[var(--good)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--good)]"
                title="Играют прямо сейчас — официальный API Steam, обновляется раз в пару минут"
              >
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--good)]" />
                {formatCountCompact(onlineQuery.data.players)} играют сейчас
              </span>
            )}
            {game.isFree && (
              <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
                Бесплатно
              </span>
            )}
            {game.genres.map((g) => (
              <span
                key={g}
                className="rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-foreground/75"
              >
                {g}
              </span>
            ))}
            {game.platforms.windows && <PlatformChip label="Windows" icon={Monitor} />}
            {game.platforms.mac && <PlatformChip label="macOS" icon={Command} />}
            {game.platforms.linux && <PlatformChip label="Linux" icon={SquareTerminal} />}
          </div>
          <dl className="mt-3 grid gap-1.5 text-sm">
            <MetaRow label="Разработчик" value={game.developers.join(", ")} icon={Building2} />
            <MetaRow label="Издатель" value={game.publishers.join(", ")} icon={Landmark} />
            <MetaRow label="Дата выхода" value={game.released} icon={CalendarDays} />
          </dl>
        </div>
      </section>

      {/* Description */}
      {(game.shortDescription || game.descriptionHtml) && (
        <section aria-label="Описание игры" className="mb-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionTitle className="mb-2">Об игре</SectionTitle>
            {game.shortDescription && (
              <p className="text-[15px] leading-relaxed text-foreground/85">
                {game.shortDescription}
              </p>
            )}
            {game.descriptionHtml && (
              <>
                <ExpandableDescription html={game.descriptionHtml} />
              </>
            )}
          </div>
        </section>
      )}

      {/* Details: players / controllers / stats / languages */}
      <GameDetails game={game} />

      {/* System requirements */}
      <RequirementsSection game={game} />

      {/* Open in Steam */}
      <a
        href={game.storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 text-sm font-bold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
        Открыть в Steam
      </a>

      {/* Screenshots */}
      {game.screenshots.length > 0 && (
        <Screenshots game={game} />
      )}

      {/* Friends' ratings */}
      <FriendsRatings gameId={id} focusReview={reviewFocus} />

      {/* Community ratings */}
      <CommunityRatings gameId={id} focusReview={reviewFocus} />

      {/* ---- Rating dialog: wheel + review + same-score carousel ---- */}
      <Dialog
        open={ratingOpen}
        onOpenChange={(open) => {
          setRatingOpen(open);
          if (!open) setLiveScore(null); // unsaved selection is discarded
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto border-border bg-card/95 p-4 grid-cols-[minmax(0,1fr)] sm:p-5">
          <DialogTitle className="text-center text-base font-extrabold">
            Ваша оценка
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-muted-foreground">
            {game.name} · выберите оценку и нажмите «Оценить»
          </DialogDescription>

          <div className="mt-2 flex items-center justify-center">
            <SaveIndicator state={user ? saveState : "anon"} />
          </div>

          {/* Выбор оценки 1–10 — отдельными кнопками (референс v3) */}
          <ScorePicker
            value={selectedScore}
            onChange={handleScoreChange}
            className="mt-1"
          />

          {/* Explicit save button — the picker only selects, never saves */}
          <Button
            type="button"
            onClick={submitScore}
            disabled={!user || saveState === "saving" || selectedScore === null}
            className="mt-2 h-11 w-full gap-2 text-sm font-bold"
          >
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Star className="h-4 w-4" aria-hidden />
            )}
            {saveState === "saving"
              ? "Сохраняем…"
              : selectedScore === null
                ? "Выберите оценку"
                : `Оценить: ${selectedScore}`}
          </Button>

          {/* Review */}
          {user ? (
            <div className="mt-2">
              {!reviewOpen ? (
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="mx-auto flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
                  {myRating?.review ? "Отзыв" : "Добавить отзыв"}
                </button>
              ) : (
                <div className="animate-fade-in">
                  <label htmlFor="review-input" className="sr-only">
                    Короткий отзыв об игре
                  </label>
                  <textarea
                    id="review-input"
                    value={reviewDraft}
                    onChange={(e) => handleReviewChange(e.target.value)}
                    rows={2}
                    placeholder="Пара слов об игре — их увидят ваши друзья"
                    className="w-full resize-none rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      {reviewDraft.length}/{MAX_REVIEW_LENGTH} ·{" "}
                      {myRating ? "сохранится автоматически" : "сохранится вместе с оценкой"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReviewOpen(false)}
                      className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Свернуть
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              <a href={loginRedirectUrl()} className="font-bold text-primary hover:underline">
                Войдите
              </a>{" "}
              — и оценка сохранится в вашем профиле.
            </p>
          )}

          {/* Same-score carousel */}
          {selectedScore !== null && (
            <SameScoreCarousel
              score={selectedScore}
              ratings={ratings}
              currentGameId={id}
              hasUser={!!user}
              hasRating={!!myRating || liveScore !== null}
              ratingsLoading={!!user && ratingsQuery.isLoading}
            />
          )}

          {myRating && (
            <button
              type="button"
              onClick={() => void removeRating()}
              className="mx-auto mt-1 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Убрать оценку
            </button>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- «Не играл» with a rating → confirm removal ---- */}
      <AlertDialog open={confirmNoneOpen} onOpenChange={setConfirmNoneOpen}>
        <AlertDialogContent className="border-border bg-card/95">
          <AlertDialogHeader>
            <AlertDialogTitle>Отметить «Не играл»?</AlertDialogTitle>
            <AlertDialogDescription>
              У вас стоит оценка {myRating?.score} этой игре. Статус «Не играл»
              её удалит (вместе с отзывом, если он есть).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmNotPlayed()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Да, «Не играл»
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function PlatformChip({ label, icon: Icon }: { label: string; icon: ComponentType<IconProps> }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Icon className="h-3 w-3 text-foreground/60" aria-hidden />
      {label}
    </span>
  );
}

function MetaRow({ label, value, icon: Icon }: { label: string; value: string; icon: ComponentType<IconProps> }) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="flex w-36 shrink-0 items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary/60" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-medium">{value || "—"}</dd>
    </div>
  );
}

function Hero({ game }: { game: Game }) {
  const [bgFailed, setBgFailed] = useState(false);
  return (
    <section className="relative -mx-4 mb-5 mt-12 overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        {!bgFailed ? (
          <img
            src={game.header}
            alt=""
            onError={() => setBgFailed(true)}
            className="h-full w-full scale-110 object-cover blur-2xl brightness-[0.9] saturate-150 dark:brightness-[0.3]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-secondary to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background dark:from-background/40 dark:via-background/70" />
      </div>
      <div className="relative flex gap-4 px-4 pb-7 pt-4 md:gap-5">
        <GameCover
          cover={game.cover}
          header={game.header}
          gameId={game.id}
          name={game.name}
          className="h-[168px] w-28 shrink-0 rounded-xl border border-white/10 shadow-2xl md:h-[210px] md:w-40"
        />
        <div className="min-w-0 self-end pb-1">
          <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight drop-shadow-sm md:text-4xl">
            {game.name}
          </h1>
          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
            {[game.released, game.developers[0]].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {game.isFree && (
              <span className="rounded-lg border border-primary/40 bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                Бесплатно
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExpandableDescription({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const sanitized = useMemo(() => sanitizeDescription(html), [html]);
  return (
    <div className="mt-1">
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div
            className="rich-html mt-2 border-t border-border/60 pt-3 text-sm text-foreground/75"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1 -ml-2 text-sm font-bold text-primary transition-colors hover:text-primary/80"
      >
        {expanded ? (
          <>
            Свернуть <ChevronUp className="h-4 w-4" aria-hidden />
          </>
        ) : (
          <>
            Читать полностью <ChevronDown className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}

/* ---------- Details: players, controllers, stats, languages ---------- */

/** Steam category id groups (verified against live appdetails responses). */
const PLAYER_CAT_IDS = new Set([1, 2, 9, 24, 36, 37, 38, 39]);
const CONTROLLER_CAT_IDS = new Set([18, 28, 55, 56, 57, 58, 59]);
const FEATURE_CAT_IDS = new Set([
  8, 13, 14, 15, 17, 23, 29, 30, 35, 41, 42, 43, 44, 51, 62,
]);

function dedupeCategories(cats: GameCategory[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cats) {
    if (seen.has(c.description)) continue;
    seen.add(c.description);
    out.push(c.description);
  }
  return out;
}

function GameDetails({ game }: { game: Game }) {
  const players = dedupeCategories(
    game.categories.filter((c) => PLAYER_CAT_IDS.has(c.id)),
  );
  const controllers = dedupeCategories(
    game.categories.filter((c) => CONTROLLER_CAT_IDS.has(c.id)),
  );
  const features = dedupeCategories(
    game.categories.filter((c) => FEATURE_CAT_IDS.has(c.id)),
  ).slice(0, 8);
  const hasAnything =
    players.length > 0 ||
    controllers.length > 0 ||
    features.length > 0 ||
    game.languages.length > 0 ||
    game.achievements !== null ||
    game.recommendations !== null ||
    game.price !== null ||
    game.isFree;
  if (!hasAnything) return null;

  return (
    <section aria-label="Детали об игре" className="mb-5">
      <SectionTitle>Детали</SectionTitle>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {/* Headline stats: price / achievements / Steam reviews */}
        <div className="flex flex-wrap gap-2">
          {game.price ? (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              <Tag className="h-3 w-3" aria-hidden />
              {game.price.final}
              {game.price.initial && (
                <s className="font-medium text-muted-foreground">
                  {game.price.initial}
                </s>
              )}
              {game.price.discount > 0 && (
                <span className="rounded-md bg-primary/20 px-1.5 py-px text-[10px] font-extrabold">
                  −{game.price.discount}%
                </span>
              )}
            </span>
          ) : (
            game.isFree && (
              <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                <Tag className="h-3 w-3" aria-hidden />
                Бесплатно
              </span>
            )
          )}
          {game.achievements !== null && game.achievements > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
              <Trophy className="h-3 w-3 text-primary/70" aria-hidden />
              {numberFmt.format(game.achievements)}{" "}
              {pluralRu(game.achievements, "достижение", "достижения", "достижений")}
            </span>
          )}
          {game.recommendations !== null && game.recommendations > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
              <MessageSquareText className="h-3 w-3 text-primary/70" aria-hidden />
              {numberFmt.format(game.recommendations)}{" "}
              {pluralRu(game.recommendations, "отзыв", "отзыва", "отзывов")} в Steam
            </span>
          )}
        </div>

        {players.length > 0 && (
          <DetailRow icon={Users} label="Игроки">
            {players.map((p) => (
              <DetailChip key={p}>{p}</DetailChip>
            ))}
          </DetailRow>
        )}

        {controllers.length > 0 && (
          <DetailRow icon={Gamepad2} label="Управление">
            {controllers.map((c) => (
              <DetailChip key={c}>{c}</DetailChip>
            ))}
          </DetailRow>
        )}

        {features.length > 0 && (
          <DetailRow icon={Sparkles} label="Возможности">
            {features.map((f) => (
              <DetailChip key={f}>{f}</DetailChip>
            ))}
          </DetailRow>
        )}

        {game.languages.length > 0 && (
          <LanguagesBlock languages={game.languages} />
        )}
      </div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-28 sm:pt-1">
        <Icon className="h-3.5 w-3.5 text-primary/60" aria-hidden />
        {label}
      </p>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function DetailChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/80 bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
      {children}
    </span>
  );
}

function LanguagesBlock({ languages }: { languages: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const visible = expanded ? languages : languages.slice(0, LIMIT);
  const hidden = languages.length - LIMIT;
  const hasStar = languages.some((l) => l.endsWith("*"));
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-28 sm:pt-1">
        <Languages className="h-3.5 w-3.5 text-primary/60" aria-hidden />
        Языки
      </p>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {visible.map((lang) => (
            <DetailChip key={lang}>{lang}</DetailChip>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
            >
              {expanded ? "свернуть" : `ещё ${hidden}`}
            </button>
          )}
        </div>
        {hasStar && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">
            * — язык с полной озвучкой
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- System requirements (Windows only) ---------- */

function RequirementsSection({ game }: { game: Game }) {
  const reqs = game.requirements;
  if (!reqs) return null;

  return (
    <section aria-label="Системные требования" className="mb-5">
      <SectionTitle>Системные требования</SectionTitle>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <PlatformChip label="Windows" icon={Monitor} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <RequirementsBlock title="Минимальные" html={reqs.minimum} />
          {reqs.recommended && (
            <RequirementsBlock title="Рекомендуемые" html={reqs.recommended} />
          )}
        </div>
      </div>
    </section>
  );
}

function RequirementsBlock({ title, html }: { title: string; html: string }) {
  const sanitized = useMemo(() => sanitizeRequirements(html), [html]);
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">
        {title}
      </p>
      <div
        className="rich-html reqs-html text-xs leading-relaxed text-foreground/75"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}

/* ---------- Screenshots ---------- */

function Screenshots({ game }: { game: Game }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
    <section aria-label="Скриншоты" className="mb-5">
      <SectionTitle>Скриншоты</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {game.screenshots.map((s, i) => (
          <button
            key={s.thumb}
            type="button"
            onClick={() => setLightbox(s.full)}
            aria-label={`Открыть скриншот ${i + 1}`}
            className="group shrink-0 snap-start overflow-hidden rounded-xl border border-border/60"
          >
            <img
              src={s.thumb}
              alt={`Скриншот ${game.name} — ${i + 1}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-[126px] w-[224px] object-cover transition-transform group-hover:scale-[1.04] md:h-[144px] md:w-[256px]"
            />
          </button>
        ))}
      </div>
      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl border-border bg-card/95 p-2">
          <DialogTitle className="sr-only">Скриншот {game.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Увеличенный скриншот игры {game.name}
          </DialogDescription>
          {lightbox && (
            <img
              src={lightbox}
              alt={`Скриншот ${game.name}`}
              referrerPolicy="no-referrer"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Friends' ratings with their reviews; a ?review=<username> deep link
 *  expands and scrolls to that friend's thread. */
function FriendsRatings({
  gameId,
  focusReview,
}: {
  gameId: string;
  focusReview: string | null;
}) {
  const { user, ready } = useAuth();
  const friendsQuery = useQuery({
    queryKey: ["friendsRatings", gameId],
    queryFn: () => api<{ items: FriendRating[] }>(
      `/api/games/${encodeURIComponent(gameId)}/friends-ratings`,
    ),
    enabled: !!user,
    staleTime: 30_000,
  });

  // Scroll the deep-linked review row into view once it has rendered.
  const scrolledFor = useRef<string | null>(null);
  const items = friendsQuery.data?.items ?? [];
  useEffect(() => {
    if (
      focusReview &&
      scrolledFor.current !== focusReview &&
      items.some((f) => f.username.toLowerCase() === focusReview)
    ) {
      scrolledFor.current = focusReview;
      document
        .getElementById(`game-review-${focusReview}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusReview, items]);

  return (
    <section aria-label="Оценки друзей" className="mb-4">
      <SectionTitle>Оценки друзей</SectionTitle>
      {!ready || (user && friendsQuery.isLoading) ? (
        <div className="rounded-xl border border-border bg-card p-2">
          <ListSkeleton count={2} />
        </div>
      ) : !user ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-4 py-8 text-center">
          <Users className="h-8 w-8 text-muted-foreground/60" aria-hidden />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Войдите, чтобы видеть, какую оценку этой игре поставили ваши друзья.
          </p>
          <Button asChild size="sm">
            <a href={loginRedirectUrl()}>
              <LogIn className="h-4 w-4" aria-hidden /> Войти
            </a>
          </Button>
        </div>
      ) : friendsQuery.error ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-card/40 p-4 text-sm text-muted-foreground">
          {friendsQuery.error.message}
        </p>
      ) : (friendsQuery.data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title="Друзья пока не оценили эту игру"
          hint="Поделитесь страницей игры или подождите — их оценки появятся здесь автоматически."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card px-2 sm:px-4">
          {items.map((f) => {
            const focused =
              !!focusReview && f.username.toLowerCase() === focusReview;
            return (
            <li
              key={f.username}
              id={focused ? `game-review-${focusReview}` : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-secondary/25 sm:-mx-2",
                focused &&
                  "bg-primary/[0.06] ring-2 ring-primary/40 ring-inset",
              )}
            >
              <a href={`#/u/${f.username}`} className="shrink-0">
                <UserAvatar username={f.username} src={f.avatarUrl} size="sm" />
              </a>
              <div className="min-w-0 flex-1">
                <UserLink username={f.username} className="text-sm font-bold" />
                <p
                  className="text-xs text-muted-foreground"
                  title={formatDateTime(f.updatedAt)}
                >
                  {timeAgo(f.updatedAt)}
                </p>
                {f.review && (
                  <p className="mt-1 line-clamp-2 break-words text-sm text-foreground/75">
                    «{f.review}»
                  </p>
                )}
                {f.review && (
                  <ReviewActions
                    gameId={gameId}
                    targetUsername={f.username}
                    likeCount={f.likeCount}
                    likedByMe={f.likedByMe}
                    commentCount={f.commentCount}
                    initialOpen={focused}
                  />
                )}
              </div>
              <ScoreBadge score={f.score} />
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Community ratings: average + distribution + all recent ratings.
 *  A ?review=<username> deep link expands that review's thread; if it is
 *  not on the loaded pages yet, the list pages itself deeper (max 5 extra
 *  pages) until the row is found. */
function CommunityRatings({
  gameId,
  focusReview,
}: {
  gameId: string;
  focusReview: string | null;
}) {
  const { user } = useAuth();

  const communityQuery = useInfiniteQuery({
    queryKey: ["community", gameId],
    queryFn: ({ pageParam }) =>
      api<CommunityResponse>(
        pageParam
          ? `/api/games/${encodeURIComponent(gameId)}/community?cursor=${pageParam}`
          : `/api/games/${encodeURIComponent(gameId)}/community`,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const stats = communityQuery.data?.pages[0]?.stats;
  const items = communityQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const maxCount = Math.max(1, ...(stats?.distribution ?? [1]));

  // Deep-link resolution: page deeper until the target review appears
  // (or the cap is reached). Runs after every page arrives.
  const pagesLoaded = communityQuery.data?.pages.length ?? 0;
  const targetLoaded =
    !focusReview ||
    items.some((i) => i.username.toLowerCase() === focusReview);
  useEffect(() => {
    if (
      focusReview &&
      !targetLoaded &&
      communityQuery.hasNextPage &&
      !communityQuery.isFetchingNextPage &&
      pagesLoaded < 6
    ) {
      void communityQuery.fetchNextPage();
    }
     
  }, [focusReview, targetLoaded, pagesLoaded, communityQuery.hasNextPage]);

  // Scroll the deep-linked review row into view once it has rendered.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (focusReview && scrolledFor.current !== focusReview && targetLoaded) {
      scrolledFor.current = focusReview;
      document
        .getElementById(`game-review-${focusReview}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusReview, targetLoaded, items]);

  return (
    <section aria-label="Оценки сообщества" className="mb-4">
      <SectionTitle>Оценки сообщества</SectionTitle>

      {communityQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-2">
          <ListSkeleton count={3} />
        </div>
      ) : communityQuery.error ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-card/40 p-4 text-sm text-muted-foreground">
          {communityQuery.error.message}
        </p>
      ) : !stats || stats.count === 0 ? (
        <EmptyState
          icon={Users}
          title="Никто ещё не оценил эту игру"
          hint="Нажмите на звёздочку — ваша оценка станет первой!"
          className="py-8"
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {/* Average + distribution */}
          <div className="flex items-center gap-4 border-b border-border/60 p-4">
            <div className="shrink-0 text-center">
              <p className="text-4xl font-extrabold tabular-nums leading-none text-primary">
                {formatAverage(stats.average)}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                из 10
              </p>
            </div>
            <div
              className="min-w-0 flex-1"
              role="img"
              aria-label={`Распределение оценок: ${stats.distribution
                .map((c, d) => `${d} — ${c}`)
                .join(", ")}`}
            >
              <div className="flex h-16 items-end gap-1">
                {stats.distribution.map((cnt, digit) => (
                  <div
                    key={digit}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        cnt === maxCount && cnt > 0
                          ? "bg-primary shadow-[0_0_10px_var(--primary)]"
                          : "bg-primary/30",
                      )}
                      style={{
                        height: cnt === 0 ? "2px" : `${Math.max(6, (cnt / maxCount) * 100)}%`,
                      }}
                    />
                    <span className="mt-0.5 text-[9px] font-bold tabular-nums text-muted-foreground/70">
                      {digit}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Всего {stats.count}{" "}
                {pluralRu(stats.count, "оценка", "оценки", "оценок")}
                {stats.wants > 0 && (
                  <>
                    {" "}· {stats.wants}{" "}
                    {pluralRu(stats.wants, "человек хочет", "человека хотят", "человек хотят")}{" "}
                    поиграть
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Recent ratings */}
          <ul className="divide-y divide-border px-2 sm:px-4">
            {items.map((item) => {
              const focused =
                !!focusReview && item.username.toLowerCase() === focusReview;
              return (
              <li
                key={`${item.username}-${item.updatedAt}`}
                id={focused ? `game-review-${focusReview}` : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-secondary/25 sm:-mx-2",
                  focused &&
                    "bg-primary/[0.06] ring-2 ring-primary/40 ring-inset",
                )}
              >
                <a href={`#/u/${item.username}`} className="shrink-0">
                  <UserAvatar username={item.username} src={item.avatarUrl} size="sm" />
                </a>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    <UserLink username={item.username} />
                    {item.isFriend && (
                      <span
                        className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary/90"
                        title="Вы подписаны на этого пользователя"
                      >
                        <UserCheck className="h-3 w-3" aria-hidden />
                        в друзьях
                      </span>
                    )}
                    {user?.username === item.username && (
                      <span className="rounded-full border border-primary/40 bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">
                        это вы
                      </span>
                    )}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    title={formatDateTime(item.updatedAt)}
                  >
                    {timeAgo(item.updatedAt)}
                  </p>
                  {item.review && (
                    <p className="mt-1 line-clamp-2 break-words text-sm text-foreground/75">
                      «{item.review}»
                    </p>
                  )}
                  {item.review && (
                    <ReviewActions
                      gameId={gameId}
                      targetUsername={item.username}
                      likeCount={item.likeCount}
                      likedByMe={item.likedByMe}
                      commentCount={item.commentCount}
                      initialOpen={focused}
                    />
                  )}
                </div>
                <ScoreBadge score={item.score} />
              </li>
              );
            })}
          </ul>

          {communityQuery.hasNextPage && (
            <div className="p-3 pt-2 text-center">
              <Button
                variant="secondary"
                size="sm"
                disabled={communityQuery.isFetchingNextPage}
                onClick={() => void communityQuery.fetchNextPage()}
              >
                {communityQuery.isFetchingNextPage
                  ? "Загрузка…"
                  : "Показать ещё"}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
        Сохранение…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-primary">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Сохранено
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
        Не сохранено — попробуйте ещё раз
      </span>
    );
  }
  // anon: prompt to log in
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="truncate">войдите, чтобы сохранять оценки</span>
      <a
        href={loginRedirectUrl()}
        className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 font-bold text-primary transition-colors hover:bg-primary/25"
      >
        Войти
      </a>
    </span>
  );
}

function SameScoreCarousel({
  score,
  ratings,
  currentGameId,
  hasUser,
  hasRating,
  ratingsLoading,
}: {
  score: number;
  ratings: RatingRow[];
  currentGameId: string;
  hasUser: boolean;
  hasRating: boolean;
  ratingsLoading: boolean;
}) {
  const list = useMemo(
    () => ratings.filter((r) => r.score === score && r.gameId !== currentGameId),
    [ratings, score, currentGameId],
  );

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Другие игры с оценкой{" "}
          <span className="font-extrabold text-primary">{score}</span>
        </p>
        {list.length > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
            {list.length}
          </span>
        )}
      </div>

      {ratingsLoading ? (
        <div className="flex gap-2 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] w-14 rounded-lg" />
          ))}
        </div>
      ) : !hasUser ? (
        <p className="flex h-[84px] items-center text-xs leading-relaxed text-muted-foreground/80">
          Здесь появятся ваши игры с той же оценкой — после входа в аккаунт.
        </p>
      ) : !hasRating ? (
        <p className="flex h-[84px] items-center text-xs leading-relaxed text-muted-foreground/80">
          Прокрутите ленту — и здесь соберутся ваши игры с выбранной оценкой.
        </p>
      ) : (
        <div key={score} className="animate-carousel-in">
          {list.length === 0 ? (
            <p className="flex h-[84px] items-center text-xs leading-relaxed text-muted-foreground/80">
              Пока других игр с оценкой {score} нет. Оцените ещё что-нибудь — и
              этот ряд заполнится!
            </p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {list.map((r) => (
                <a
                  key={r.gameId}
                  href={`#/game/${r.gameId}`}
                  title={r.gameName}
                  className="group shrink-0"
                >
                  <GameCover
                    cover={r.gameCover}
                    gameId={r.gameId}
                    name={r.gameName}
                    className="h-[84px] w-14 rounded-lg border border-border/60 shadow-sm transition-transform group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
