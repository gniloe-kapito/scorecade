"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Gamepad2,
  Library as LibraryIcon,
  Loader2,
  PenLine,
  Search,
  SearchX,
  Star,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SITE_NAME } from "@/lib/config";
import { GameCover } from "@/components/app/GameCover";
import { ScoreBadge } from "@/components/app/ScoreBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { gameModalClickHandler } from "@/components/app/game-modal-store";
import { ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import { formatAverage, formatDateTime, pluralRu, timeAgo } from "@/lib/format";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type GameStatusValue,
  type LibraryItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "name" | "best" | "worst";

const SORTS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Сначала последние" },
  { value: "name", label: "По названию" },
  { value: "best", label: "Высокие оценки" },
  { value: "worst", label: "Низкие оценки" },
];

/** Фильтр по отметке: null = все игры. */
type StatusFilter = GameStatusValue | "all" | "rated";

/** #/library — моя библиотека: все игры, на которых есть оценка, отметка
 *  или отзыв. Данные — /api/me/library (слияние Rating ∪ GameStatus на
 *  сервере), кэш ["library"] общий с превью на главной и обновляется
 *  сразу после сохранения оценки в окне игры. */
export function LibraryView() {
  const { user, ready } = useAuth();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const trimmed = debounced.trim();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    document.title = `Моя библиотека — ${SITE_NAME}`;
  }, []);

  const libraryQuery = useQuery({
    queryKey: ["library"],
    queryFn: () => api<{ items: LibraryItem[] }>("/api/me/library"),
    enabled: !!user,
    staleTime: 15_000,
  });

  if (!ready || (ready && !user && libraryQuery.isLoading)) {
    return (
      <div className="py-8">
        <ListSkeleton count={5} />
      </div>
    );
  }

  if (ready && !user) {
    return (
      <div className="py-10">
        <EmptyState
          icon={LibraryIcon}
          title="Библиотека живёт в вашем аккаунте"
          hint="Оценки, отметки «Играю» и «Хочу сыграть» и отзывы появятся здесь сразу после входа."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <a href="#/login?from=%23%2Flibrary">Войти</a>
              </Button>
              <Button asChild variant="secondary">
                <a href="#/register">Создать аккаунт</a>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const items = libraryQuery.data?.items ?? [];
  const rated = items.filter((i) => i.score !== null);
  const reviews = items.filter((i) => !!i.review);
  const average =
    rated.length > 0
      ? rated.reduce((sum, i) => sum + (i.score ?? 0), 0) / rated.length
      : null;

  const filtered = items.filter((it) => {
    if (statusFilter === "rated") return it.score !== null;
    if (statusFilter !== "all" && it.status !== statusFilter) return false;
    if (trimmed.length > 0) {
      return it.gameName.toLowerCase().includes(trimmed.toLowerCase());
    }
    return true;
  });

  const sorted = (() => {
    const list = [...filtered];
    switch (sort) {
      case "name":
        return list.sort((a, b) => a.gameName.localeCompare(b.gameName, "ru"));
      case "best":
        return list.sort(
          (a, b) => (b.score ?? -1) - (a.score ?? -1) || b.updatedAt.localeCompare(a.updatedAt),
        );
      case "worst":
        return list.sort(
          (a, b) => (a.score ?? 11) - (b.score ?? 11) || b.updatedAt.localeCompare(a.updatedAt),
        );
      default:
        return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  })();

  const statusCounts = new Map<GameStatusValue, number>();
  for (const it of items) {
    if (it.status) statusCounts.set(it.status, (statusCounts.get(it.status) ?? 0) + 1);
  }

  return (
    <div className="py-6 md:py-8">
      {/* Заголовок страницы */}
      <section className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            Моя полка
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Библиотека
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Только то, что вы сами отметили: оценки, статусы и отзывы. Часы
            игры и проценты прохождения не показываем — их у нас нет.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <a href="#/games">
            Найти новую игру
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      </section>

      {/* Сводка */}
      <p className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          <strong className="mr-1 text-base font-bold text-foreground">
            {items.length}
          </strong>
          {pluralRu(items.length, "игра", "игры", "игр")}
        </span>
        <span>
          <strong className="mr-1 text-base font-bold text-foreground">
            {rated.length}
          </strong>
          {pluralRu(rated.length, "оценка", "оценки", "оценок")}
        </span>
        <span>
          <strong className="mr-1 text-base font-bold text-foreground">
            {reviews.length}
          </strong>
          {pluralRu(reviews.length, "отзыв", "отзыва", "отзывов")}
        </span>
        <span>
          <strong className="mr-1 text-base font-bold text-foreground">
            {formatAverage(average)}
          </strong>
          средняя оценка
        </span>
      </p>

      {/* Инструменты: поиск + сортировка */}
      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию в библиотеке…"
            aria-label="Поиск по библиотеке"
            className="h-10 w-full rounded-md border border-[var(--input)] bg-card pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Сортировка библиотеки"
          className="h-10 rounded-md border border-[var(--input)] bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Вкладки-статусы */}
      <div
        role="group"
        aria-label="Фильтр по отметке"
        className="no-scrollbar mb-5 flex flex-wrap gap-1.5 overflow-x-auto pb-1"
      >
        <StatusTab
          label="Все"
          count={items.length}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatusTab
          label="С оценкой"
          count={rated.length}
          active={statusFilter === "rated"}
          onClick={() => setStatusFilter("rated")}
        />
        {STATUS_ORDER.filter((s) => (statusCounts.get(s) ?? 0) > 0).map((s) => (
          <StatusTab
            key={s}
            label={STATUS_LABELS[s]}
            count={statusCounts.get(s) ?? 0}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {/* Содержимое */}
      {libraryQuery.isLoading ? (
        <ListSkeleton count={6} />
      ) : libraryQuery.error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/40 p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            {libraryQuery.error.message}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => libraryQuery.refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="Библиотека пока пуста"
          hint="Откройте каталог или нажмите на карточку игры на главной — в компактном окне можно поставить оценку, выбрать отметку и написать отзыв."
          action={
            <Button asChild size="sm">
              <a href="#/games">Открыть каталог</a>
            </Button>
          }
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Ничего не нашлось"
          hint={
            trimmed
              ? `В библиотеке нет игр, похожих на «${trimmed}».`
              : "Нет игр с таким фильтром — выберите другую отметку."
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {sorted.map((it) => (
            <LibraryRow key={it.gameId} item={it} />
          ))}
        </ul>
      )}

      {sorted.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Изменения сразу видны в{" "}
          <a href="#/me" className="font-semibold text-primary hover:underline">
            вашем профиле
          </a>{" "}
          и в ленте друзей. Нажмите «Изменить», чтобы поправить оценку, отметку
          или отзыв.
        </p>
      )}
    </div>
  );
}

function StatusTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-[var(--primary-soft)] text-primary"
          : "border-[var(--input)] bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
          active ? "bg-primary/20" : "bg-secondary",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Строка библиотеки: капсульная обложка, название, отметка, оценка,
 *  отзыв. Клик по строке открывает компактное окно игры (там же —
 *  изменение и удаление). */
function LibraryRow({ item }: { item: LibraryItem }) {
  return (
    <li>
      <a
        href={`#/game/${item.gameId}`}
        onClick={gameModalClickHandler(item.gameId)}
        aria-label={`${item.gameName} — изменить оценку и отметку`}
        className="group grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 p-3 transition-colors hover:bg-secondary/40 sm:grid-cols-[120px_minmax(0,1fr)_auto_auto]"
      >
        <GameCover
          cover={item.gameCover}
          gameId={item.gameId}
          name={item.gameName}
          className="aspect-[460/215] w-full rounded border border-border object-cover"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold transition-colors group-hover:text-primary">
              {item.gameName}
            </span>
            {item.status ? (
              <span className="hidden shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
                {STATUS_LABELS[item.status]}
              </span>
            ) : null}
          </span>
          {item.review ? (
            <span className="mt-0.5 line-clamp-2 block break-words text-xs leading-relaxed text-muted-foreground">
              {item.review}
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-muted-foreground/70">
              без отзыва
            </span>
          )}
          <span
            className="mt-0.5 block text-[10px] text-muted-foreground/70"
            title={formatDateTime(item.updatedAt)}
          >
            {timeAgo(item.updatedAt)}
          </span>
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          {item.score !== null ? (
            <ScoreBadge score={item.score} size="sm" />
          ) : (
            <span className="text-xs text-muted-foreground">не оценена</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {item.score !== null ? (
            <ScoreBadge score={item.score} size="sm" className="sm:hidden" />
          ) : null}
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
            <PenLine className="h-4 w-4" aria-hidden />
          </span>
        </span>
      </a>
    </li>
  );
}
