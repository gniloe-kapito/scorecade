"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ExternalLink,
  Gamepad2,
  Loader2,
  LogIn,
  MessageSquareText,
  Skull,
  Star,
  Trash2,
  TriangleAlert,
  Trophy,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  lowScoreHint,
  lowScoreNeedsReview,
  lowScoreRemaining,
  lowScoreReviewOk,
} from "@/lib/low-score";
import { formatAverage, formatCountCompact, pluralRu } from "@/lib/format";
import type {
  CommunityResponse,
  Game,
  GameStatusValue,
  RatingRow,
  StatusRow,
} from "@/lib/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GameCover } from "@/components/app/GameCover";
import { closeGameModal, openGameModal, useGameModalId } from "@/components/app/game-modal-store";
import { cn } from "@/lib/utils";

/** Компактное окно игры: шапка (обложка + название + оценка сообщества)
 *  не менялась, а зона оценки переработана по образцу Кинопоиска —
 *  крупная шкала цифр 1–10, отдельная кнопка «Поставить оценку»,
 *  отметки сохраняются мгновенно (независимо от оценки), под шкалой —
 *  «Ваши игры на N» и отзыв. Полная страница игры — отдельный маршрут. */
export function GameModal() {
  const id = useGameModalId();
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && closeGameModal()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[50%] max-h-[92vh] gap-0 overflow-y-auto rounded-xl border-border bg-card p-0 shadow-[var(--glow-card)] sm:max-w-[570px]"
      >
        {id ? <ModalBody key={id} id={id} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ModalBody({ id }: { id: string }) {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();

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

  // Тот же ключ, что и страница игры: статистика сообщества не грузится дважды.
  const communityQuery = useInfiniteQuery({
    queryKey: ["community", id],
    queryFn: ({ pageParam }) =>
      api<CommunityResponse>(
        pageParam
          ? `/api/games/${encodeURIComponent(id)}/community?cursor=${pageParam}`
          : `/api/games/${encodeURIComponent(id)}/community`,
      ),
    initialPageParam: "",
    getNextPageParam: () => undefined,
    staleTime: 30_000,
  });

  // Текущий онлайн — официальный Web API Valve (без ключа). Кэш 1 минута,
  // чтобы цифра была живой, но без спама запросами при каждом открытии окна.
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
  const myRating = useMemo(
    () => ratingsQuery.data?.ratings.find((r) => r.gameId === id) ?? null,
    [ratingsQuery.data, id],
  );
  const myStatus = useMemo(
    () => statusesQuery.data?.statuses.find((s) => s.gameId === id)?.status ?? null,
    [statusesQuery.data, id],
  );
  const stats = communityQuery.data?.pages[0]?.stats ?? null;

  // ---- редактируемое состояние (синхронизируется один раз на игру) ----
  const [score, setScore] = useState<number | null>(null);
  const [status, setStatus] = useState<GameStatusValue | null>(null);
  const [review, setReview] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  if (!synced) {
    setSynced(true);
    setScore(myRating?.score ?? null);
    setStatus(myStatus);
    setReview(myRating?.review ?? "");
    setReviewOpen(!!myRating?.review);
  }

  // Низкая оценка (0–4) требует отзыв — поле отзыва всегда раскрыто.
  useEffect(() => {
    if (score !== null && lowScoreNeedsReview(score)) setReviewOpen(true);
  }, [score]);

  useEffect(() => {
    // Сброс при закрытии/смене игры происходит через key={id} (remount).
    if (game) document.title = `${game.name} — Scorecade`;
  }, [game]);

  // Отметка сохраняется отдельно от оценки — «dirty» только для шкалы/отзыва.
  const dirty =
    score !== (myRating?.score ?? null) ||
    (review.trim() || null) !== (myRating?.review ?? null);

  /** Зеркалит статус в кэш ["myStatuses"] (как страница игры). */
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

  const invalidateAfterChange = useCallback(() => {
    for (const key of ["community", "communityTop", "profile", "library", "feed"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  /** Отметка — мгновенное сохранение, без оценки (как на странице игры).
   *  Клик по активной отметке снимает её. */
  const applyStatus = useCallback(
    async (next: GameStatusValue | null) => {
      if (!user || !game) return;
      const was = status;
      setStatus(next);
      patchStatusCache(next);
      setStatusBusy(true);
      try {
        await api(`/api/status/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: {
            status: next ?? "none",
            game_name: game.name,
            game_cover: game.cover,
          },
        });
        invalidateAfterChange();
        toast(
          next
            ? `Отмечено: «${STATUS_LABELS[next]}»`
            : "Отметка снята",
        );
      } catch (err) {
        setStatus(was);
        patchStatusCache(was);
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось сохранить отметку.",
        );
      } finally {
        setStatusBusy(false);
      }
    },
    [user, game, id, status, patchStatusCache, invalidateAfterChange],
  );

  const save = async () => {
    if (!user || !game) return;
    if (score === null) {
      setError("Сначала выберите оценку от 1 до 10.");
      return;
    }
    // Оценка 0–4 сохраняется только с отзывом (кнопка заблокирована,
    // но проверим и здесь — единое поведение со страницей игры).
    if (!lowScoreReviewOk(score, review)) {
      setError(lowScoreHint());
      setReviewOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleanReview = review.trim() ? review.trim() : null;
      await api(`/api/ratings/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: {
          score,
          review: cleanReview,
          game_name: game.name,
          game_cover: game.cover,
        },
      });
      const row: RatingRow = {
        gameId: id,
        gameName: game.name,
        gameCover: game.cover,
        score,
        review: cleanReview,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<{ ratings: RatingRow[] }>(["myRatings"], (old) => {
        const base = old?.ratings ?? [];
        const idx = base.findIndex((r) => r.gameId === id);
        if (idx === -1) return { ratings: [row, ...base] };
        const next = [...base];
        next[idx] = row;
        return { ratings: next };
      });
      // Оценка ставит «Играл(а)» на сервере, если точной отметки нет;
      // отражаем это в кэше (явная отметка важнее и не трогается).
      if (status === null || status === "want") {
        patchStatusCache(status ?? "played");
        if (status === null) setStatus("played");
      }
      invalidateAfterChange();
      toast.success(`Оценка сохранена: ${score}/10`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось сохранить оценку.",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeRating = async () => {
    if (!user || !myRating) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/ratings/${encodeURIComponent(id)}`, { method: "DELETE" });
      queryClient.setQueryData<{ ratings: RatingRow[] }>(["myRatings"], (old) => ({
        ratings: (old?.ratings ?? []).filter((r) => r.gameId !== id),
      }));
      invalidateAfterChange();
      setScore(null);
      setReview("");
      setReviewOpen(false);
      toast("Оценка удалена");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось удалить оценку.",
      );
    } finally {
      setBusy(false);
    }
  };

  // ---------- рендер ----------

  if (gameQuery.isLoading) {
    return (
      <div className="p-5">
        <DialogTitle className="sr-only">Окно игры</DialogTitle>
        <div className="flex animate-pulse gap-4">
          <div className="h-[58px] w-[124px] rounded-md bg-secondary" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="h-5 w-2/3 rounded bg-secondary" />
            <div className="h-3 w-1/3 rounded bg-secondary" />
          </div>
        </div>
        <div className="mt-6 flex justify-between gap-2 px-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-11 w-11 rounded-full bg-secondary" />
          ))}
        </div>
        <div className="mt-5 h-11 rounded-full bg-secondary" />
        <div className="mt-4 h-14 rounded-md bg-secondary" />
      </div>
    );
  }

  if (gameQuery.error || !game) {
    return (
      <div className="p-5">
        <DialogTitle className="sr-only">Окно игры</DialogTitle>
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            {gameQuery.error instanceof ApiError
              ? gameQuery.error.message
              : "Не удалось загрузить игру."}
          </p>
          <DialogCloseButton />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => gameQuery.refetch()}>
            Повторить
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={`#/game/${id}`}>Открыть страницу игры</a>
          </Button>
        </div>
      </div>
    );
  }

  const appId = id.startsWith("steam:") ? id.slice("steam:".length) : null;

  return (
    <div>
      {/* --- Шапка: обложка + название + оценка сообщества (не трогать) --- */}
      <div className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-start gap-3.5 border-b border-border bg-secondary/40 p-4 sm:grid-cols-[124px_minmax(0,1fr)_30px] sm:p-5">
        <GameCover
          cover={game.cover}
          header={game.header}
          gameId={id}
          name={game.name}
          className="aspect-[460/215] w-full rounded-md border border-border object-cover"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            Игра · Steam
          </p>
          <DialogTitle className="mt-1 truncate text-lg font-bold leading-tight sm:text-xl">
            {game.name}
          </DialogTitle>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {[game.genres.slice(0, 2).join(", "), game.released?.split(" г.")[0]]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-semibold text-foreground/90">
              {stats && stats.count > 0 ? (
                <>
                  <Star className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
                  Scorecade {formatAverage(stats.average)} · {stats.count}{" "}
                  {pluralRu(stats.count, "оценка", "оценки", "оценок")}
                </>
              ) : (
                "Scorecade: пока без оценок"
              )}
            </span>
            {appId && <span className="text-muted-foreground">AppID {appId}</span>}
            {onlineQuery.data?.players != null && (
              <span
                className="inline-flex items-center gap-1 text-muted-foreground"
                title={`Играют прямо сейчас — данные официального API Steam (обновляется раз в пару минут)`}
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" />
                {formatCountCompact(onlineQuery.data.players)} играют сейчас
              </span>
            )}
          </p>
          <a
            href={game.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Открыть страницу в Steam
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
        <DialogCloseButton />
      </div>

      {/* --- Зона оценки (Кинопоиск) --- */}
      <div className="p-4 sm:p-5">
        {ready && !user ? (
          <div className="py-4 text-center">
            <LogIn className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-semibold">
              Оценивать игры могут только участники
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Заведите аккаунт — оценка, отметка и отзыв появятся в вашей
              библиотеке и в ленте друзей.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button asChild size="sm">
                <a href={`#/login?from=${encodeURIComponent(window.location.hash || "#/")}`}>
                  Войти
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a href="#/register">Создать аккаунт</a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Шкала оценки: крупные цифры, выбранная — в круге (Кинопоиск) */}
            <section aria-label="Моя оценка">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Твоя оценка</h3>
                  <p className="text-xs text-muted-foreground">
                    Насколько тебе понравилась игра?
                  </p>
                </div>
                <span
                  className={cn(
                    "min-w-[66px] rounded-md border border-[var(--input)] bg-secondary px-2 py-1 text-center text-lg font-bold tabular-nums",
                    score !== null ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {score ?? "—"}
                  <small className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                    /10
                  </small>
                </span>
              </div>
              <ScoreScale value={score} onChange={setScore} disabled={busy} />
            </section>

            {/* Отметки: мгновенное сохранение, не требуют оценки */}
            <section aria-label="Моя отметка" className="mt-4">
              <h3 className="mb-2 text-sm font-bold">
                Твоя отметка
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  сохраняется сразу
                </span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_ORDER.map((s) => (
                  <StatusChip
                    key={s}
                    value={s}
                    active={status === s}
                    disabled={statusBusy}
                    onClick={() => void applyStatus(status === s ? null : s)}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Отметка — это ваш личный статус игры; часы и прогресс прохождения
                Scorecade не показывает и не придумывает.
              </p>
            </section>

            {/* Подсказка о правиле низкой оценки — над главной кнопкой */}
            {lowScoreNeedsReview(score) && (
              <p
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2 text-[11px] font-semibold leading-relaxed",
                  lowScoreReviewOk(score, review)
                    ? "border-border bg-secondary/50 text-muted-foreground"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                {lowScoreHint()}
                {!lowScoreReviewOk(score, review) && (
                  <> — осталось {lowScoreRemaining(review)}</>
                )}
              </p>
            )}

            {/* Главная кнопка (Кинопоиск: «Поставить оценку») */}
            <Button
              onClick={() => void save()}
              disabled={
                busy ||
                score === null ||
                !dirty ||
                !lowScoreReviewOk(score, review)
              }
              className="mt-4 h-11 w-full rounded-full text-[15px] font-extrabold"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Сохраняем…
                </>
              ) : myRating ? (
                <>
                  <Star className="h-4 w-4" aria-hidden />
                  Сохранить оценку
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" aria-hidden />
                  Поставить оценку
                </>
              )}
            </Button>

            {error && (
              <p
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs text-destructive"
              >
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                {error}
              </p>
            )}

            {/* «Ваши игры на N» — как на полной странице игры */}
            {score !== null && (
              <SameScoreGames
                score={score}
                ratings={ratingsQuery.data?.ratings ?? []}
                currentGameId={id}
                loading={ratingsQuery.isLoading}
              />
            )}

            {/* Отзыв — раскрывающийся (у Кинопоиска его нет, наш бонус) */}
            <section aria-label="Мой отзыв" className="mt-4">
              <button
                type="button"
                onClick={() => setReviewOpen((v) => !v)}
                aria-expanded={reviewOpen}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--input)] bg-background px-3 py-2.5 text-sm font-bold transition-colors hover:border-primary/50"
              >
                <span className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-primary" aria-hidden />
                  {review.trim()
                    ? "Отзыв написан — редактировать"
                    : "Добавить отзыв"}
                  <span
                    className={cn(
                      "font-normal",
                      lowScoreNeedsReview(score)
                        ? "font-bold text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {lowScoreNeedsReview(score) ? "обязательно" : "необязательно"}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                    reviewOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {reviewOpen && (
                <div className="animate-collapse-in">
                  <textarea
                    id="game-modal-review"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    maxLength={1000}
                    disabled={busy}
                    placeholder={
                      lowScoreNeedsReview(score)
                        ? "Чем не понравилась игра? Расскажите — это обязательно при низкой оценке"
                        : "Что запомнилось? Что понравилось или не зашло? Помоги друзьям решить, стоит ли играть."
                    }
                    rows={3}
                    className="mt-2 w-full resize-y rounded-md border border-[var(--input)] bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary disabled:opacity-60"
                  />
                  <p
                    className={cn(
                      "mt-1 text-right text-[10px]",
                      lowScoreNeedsReview(score) &&
                        !lowScoreReviewOk(score, review)
                        ? "font-bold text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {review.length}/1000
                    {lowScoreNeedsReview(score) &&
                      !lowScoreReviewOk(score, review) &&
                      ` · осталось ${lowScoreRemaining(review)}`}
                  </p>
                </div>
              )}
            </section>

            {/* Низ: полная страница + удаление оценки */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <a href={`#/game/${id}`}>Подробнее об игре →</a>
              </Button>
              {myRating && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeRating()}
                  disabled={busy}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Удалить оценку
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ==================== Шкала оценки (стиль Кинопоиска) ==================== */

/** Крупные цифры 1–10 в один ряд; выбранная — акцентный круг.
 *  Клик по уже выбранной цифре её снимает. */
function ScoreScale({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Оценка от 1 до 10"
      className="grid grid-cols-10 gap-1"
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Оценка ${n}`}
            disabled={disabled}
            onClick={() => onChange(active ? null : n)}
            className={cn(
              "flex h-11 items-center justify-center rounded-full text-[17px] font-extrabold tabular-nums transition-all duration-300 sm:h-12 sm:text-lg",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]",
              active
                ? "scale-110 bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--primary-soft)]"
                : "text-foreground/70 hover:scale-105 hover:bg-secondary hover:text-primary",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/* ==================== Чип отметки ==================== */

const STATUS_ICONS: Record<GameStatusValue, typeof Gamepad2> = {
  playing: Gamepad2,
  beaten: Trophy,
  dropped: Skull,
  played: Check,
  want: BookmarkPlus,
};

function StatusChip({
  value,
  active,
  disabled,
  onClick,
}: {
  value: GameStatusValue;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = STATUS_ICONS[value];
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.96]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-[var(--input)] bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {STATUS_LABELS[value]}
    </button>
  );
}

/* ==================== «Ваши игры на N» ==================== */

/** Мини-карусель игр с той же оценкой (как SameScoreCarousel на странице
 *  игры). Клик по обложке переключает окно на ту игру. */
function SameScoreGames({
  score,
  ratings,
  currentGameId,
  loading,
}: {
  score: number;
  ratings: RatingRow[];
  currentGameId: string;
  loading: boolean;
}) {
  const list = useMemo(
    () => ratings.filter((r) => r.score === score && r.gameId !== currentGameId),
    [ratings, score, currentGameId],
  );

  return (
    <div key={score} className="mt-4 animate-collapse-in">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ваши игры на{" "}
          <span className="font-extrabold text-primary">{score}</span>
        </p>
        {list.length > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
            {list.length}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex gap-2 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] w-[52px] animate-pulse rounded-lg bg-secondary"
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="flex h-[72px] items-center text-xs leading-relaxed text-muted-foreground/80">
          {`Других игр с оценкой ${score} пока нет — оцените ещё что-нибудь, и этот ряд заполнится.`}
        </p>
      ) : (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {list.map((r) => (
            <button
              key={r.gameId}
              type="button"
              onClick={() => openGameModal(r.gameId)}
              title={r.gameName}
              aria-label={`${r.gameName} — открыть в этом окне`}
              className="group shrink-0"
            >
              <GameCover
                cover={r.gameCover}
                gameId={r.gameId}
                name={r.gameName}
                className="h-[72px] w-[52px] rounded-lg border border-border/60 object-cover shadow-sm transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DialogCloseButton() {
  return (
    <button
      type="button"
      onClick={closeGameModal}
      aria-label="Закрыть окно игры"
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
