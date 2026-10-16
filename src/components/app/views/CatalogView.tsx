"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  Command,
  Gamepad2,
  Loader2,
  Monitor,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
  SquareTerminal,
  Star,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHashRoute, navigate } from "@/lib/router";
import { SITE_NAME } from "@/lib/config";
import { GameCard } from "@/components/app/GameCard";
import { GameCover } from "@/components/app/GameCover";
import { EmptyState } from "@/components/app/EmptyState";
import { CapsuleGridSkeleton, CoverGridSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import { formatAverage, pluralRu } from "@/lib/format";
import type {
  BrowseOs,
  BrowseResponse,
  BrowseSection,
  BrowseSort,
  CommunityTopItem,
  StatusRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Вкладки каталога. Пять разделов — реальная выдача страницы поиска
 *  Steam с пагинацией; «scorecade» — собственный рейтинг проекта. */
const SECTION_TABS: ReadonlyArray<{
  value: BrowseSection | "scorecade";
  label: string;
  hint: string;
  /** Сортировка по умолчанию для вкладки (в hash не пишется). */
  defaultSort: BrowseSort;
}> = [
  { value: "all", label: "Популярные сейчас", hint: "порядок витрины Steam ≈ популярность", defaultSort: "relevance" },
  { value: "topsellers", label: "Лидеры продаж", hint: "по продажам в магазине Steam", defaultSort: "relevance" },
  { value: "new", label: "Новинки Steam", hint: "сначала самые свежие релизы", defaultSort: "released" },
  { value: "coming", label: "Скоро выйдут", hint: "предстоящие релизы", defaultSort: "relevance" },
  { value: "specials", label: "Скидки", hint: "текущие скидки магазина", defaultSort: "relevance" },
  {
    value: "scorecade",
    label: "Топ Scorecade",
    hint: "по оценкам пользователей — не зависит от Steam",
    defaultSort: "relevance",
  },
];

const SORTS: ReadonlyArray<{
  value: BrowseSort;
  label: string;
}> = [
  { value: "relevance", label: "По популярности" },
  { value: "released", label: "Сначала новые" },
  { value: "reviews", label: "По отзывам Steam" },
  { value: "priceasc", label: "Цена ↑" },
  { value: "pricedesc", label: "Цена ↓" },
  { value: "name", label: "По алфавиту" },
];

const PLATFORMS: ReadonlyArray<{
  value: BrowseOs;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: "win", label: "Windows", icon: Monitor },
  { value: "mac", label: "macOS", icon: Command },
  { value: "linux", label: "Linux", icon: SquareTerminal },
];

export function CatalogView() {
  const route = useHashRoute();
  const { user } = useAuth();
  const [query, setQuery] = useState(() => route.query.get("q") ?? "");
  const debounced = useDebouncedValue(query, 350);
  const trimmed = debounced.trim();
  const searching = trimmed.length >= 2;

  useEffect(() => {
    document.title = `Каталог игр — ${SITE_NAME}`;
  }, []);

  // Мои отметки — бейджи на карточках (общий кэш с другими страницами).
  const statusesQuery = useQuery({
    queryKey: ["myStatuses"],
    queryFn: () => api<{ statuses: StatusRow[] }>("/api/me/statuses"),
    enabled: !!user,
    staleTime: Infinity,
  });
  const myStatuses = new Map(
    (statusesQuery.data?.statuses ?? []).map((s) => [s.gameId, s.status]),
  );

  // Состояние берётся из hash-параметров (#/games?section=…&platform=…&sort=…&q=…):
  // вкладки/фильтры шарятся через ссылку и работают с кнопкой «назад».
  const rawSection = route.query.get("section") ?? "";
  const tab = SECTION_TABS.find((t) => t.value === rawSection) ?? SECTION_TABS[0];
  const section = tab.value;
  const isScorecadeTab = section === "scorecade" && !searching;

  const rawPlatform = route.query.get("platform") ?? "";
  const platform: BrowseOs | null = PLATFORMS.some((p) => p.value === rawPlatform)
    ? (rawPlatform as BrowseOs)
    : null;

  const rawSort = route.query.get("sort") ?? "";
  const sort: BrowseSort = SORTS.some((s) => s.value === rawSort)
    ? (rawSort as BrowseSort)
    : tab.defaultSort;

  /** Управление фильтрами через hash (значения по умолчанию не пишем). */
  function updateHash(patch: {
    section?: string;
    platform?: string | null;
    sort?: string | null;
    q?: string | null;
  }) {
    const nextSection = patch.section ?? section;
    const nextTab =
      SECTION_TABS.find((t) => t.value === nextSection) ?? SECTION_TABS[0];
    const nextPlatform = patch.platform === undefined ? platform : patch.platform;
    const nextSort =
      patch.sort === undefined
        ? sort
        : patch.sort === null
          ? nextTab.defaultSort
          : (patch.sort as BrowseSort);
    const nextQ = patch.q === undefined ? (route.query.get("q") ?? "") : patch.q;
    const params = new URLSearchParams();
    if (nextSection !== "all") params.set("section", nextSection);
    if (nextPlatform) params.set("platform", nextPlatform);
    if (nextSort !== nextTab.defaultSort) params.set("sort", nextSort);
    if (nextQ !== null && nextQ.trim().length >= 2) params.set("q", nextQ.trim());
    const qs = params.toString();
    navigate(qs ? `#/games?${qs}` : "#/games");
  }

  // Переключение вкладки сбрасывает сортировку на дефолт вкладки —
  // иначе «Новинки» наследовали бы чужую сортировку.
  function switchTab(value: string) {
    const nextTab = SECTION_TABS.find((t) => t.value === value);
    updateHash({
      section: value,
      sort: nextTab ? nextTab.defaultSort : null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hasFilters =
    section !== "all" || platform !== null || sort !== tab.defaultSort ||
    (route.query.get("q") ?? "").trim().length >= 2;

  /** Бесконечная прокрутка: страница за страницей каталога Steam
   *  (50 игр на страницу — как на странице поиска магазина). */
  const browseQuery = useInfiniteQuery({
    queryKey: [
      "browse",
      {
        section: searching ? "search" : section,
        q: searching ? trimmed : null,
        os: platform,
        sort: searching ? "relevance" : sort,
      },
    ],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (searching) {
        params.set("q", trimmed);
      } else {
        params.set("section", section);
        params.set("sort", sort);
        if (platform) params.set("os", platform);
      }
      params.set("page", String(pageParam));
      return api<BrowseResponse>(`/api/games/browse?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !isScorecadeTab,
    staleTime: 10 * 60 * 1000, // согласовано с TTL бэкенда
  });

  // Топ Scorecade — отдельный рейтинг сообщества (общий кэш с главной).
  const topQuery = useQuery({
    queryKey: ["communityTop"],
    queryFn: () =>
      api<{ items: CommunityTopItem[] }>("/api/games/community-top"),
    enabled: isScorecadeTab,
    staleTime: 60_000,
  });

  const items = useMemo(
    () => browseQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [browseQuery.data],
  );
  const total = browseQuery.data?.pages[0]?.total ?? 0;

  // Сентинел бесконечной прокрутки: срабатывает заранее (rootMargin),
  // следующая страница грузится ещё до достижения конца списка.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchNextPage = browseQuery.fetchNextPage;
  const hasNextPage = browseQuery.hasNextPage;
  const isFetchingNextPage = browseQuery.isFetchingNextPage;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const activeTab = SECTION_TABS.find((t) => t.value === section);

  return (
    <div className="py-6 md:py-8">
      {/* Заголовок страницы */}
      <section className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            Открывай, а не просто листай
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Каталог игр
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Весь каталог Steam —{" "}
            {total > 0
              ? `${total.toLocaleString("ru-RU")} ${pluralRu(total, "игра", "игры", "игр")}`
              : "десятки тысяч игр"}
            . Листайте вниз: новые игры подгружаются автоматически.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
          <a href="#/library">Моя библиотека →</a>
        </Button>
      </section>

      {/* Поиск — большой, во всю ширину */}
      <section aria-label="Поиск по каталогу" className="mb-5">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground md:left-5"
          />
          <input
            id="catalog-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query.length > 0) {
                setQuery("");
                e.currentTarget.blur();
              } else if (e.key === "Enter" && searching) {
                updateHash({ q: trimmed });
                e.currentTarget.blur();
              }
            }}
            placeholder="Найти игру в каталоге Steam…"
            aria-label="Поиск игр по каталогу"
            autoComplete="off"
            className={cn(
              "h-12 w-full rounded-xl border border-[var(--input)] bg-card pl-12 pr-5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-[var(--line-strong)] focus:border-primary md:h-14 md:text-base [&::-webkit-search-cancel-button]:hidden",
              query.length > 0 ? "pr-12" : "",
            )}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                if ((route.query.get("q") ?? "").trim().length >= 2) {
                  updateHash({ q: null });
                }
              }}
              aria-label="Очистить поиск"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        {query.trim().length > 0 && !searching && (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Введите минимум 2 символа
          </p>
        )}
      </section>

      {/* Вкладки + фильтры */}
      <section
        aria-label="Разделы и фильтры каталога"
        className="mb-6 space-y-3"
      >
        <div
          role="tablist"
          aria-label="Подборки каталога"
          className={cn(
            "no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto border-b border-border px-1 pb-px",
            searching && "pointer-events-none opacity-50",
          )}
        >
          {SECTION_TABS.map((t) => {
            const active = !searching && section === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="catalog-panel"
                onClick={() => switchTab(t.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Платформа и сортировка — для разделов и поиска (источник
            поддерживает их вместе с поисковым запросом). */}
        {!isScorecadeTab && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Фильтр по платформе"
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Платформа
              </span>
              <FilterPill
                label="Все"
                icon={Gamepad2}
                pressed={platform === null}
                onClick={() => updateHash({ platform: null })}
              />
              {PLATFORMS.map((p) => (
                <FilterPill
                  key={p.value}
                  label={p.label}
                  icon={p.icon}
                  pressed={platform === p.value}
                  onClick={() =>
                    updateHash({
                      platform: platform === p.value ? null : p.value,
                    })
                  }
                />
              ))}
            </div>
            {!searching && (
              <div
                role="group"
                aria-label="Сортировка"
                className="flex flex-wrap items-center gap-1.5"
              >
                <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Сортировка
                </span>
                {SORTS.map((s) => (
                  <FilterPill
                    key={s.value}
                    label={s.label}
                    icon={s.value === "released" ? Sparkles : s.value === "reviews" ? Star : s.value === "name" ? TrendingUp : ArrowDown}
                    pressed={sort === s.value}
                    onClick={() => updateHash({ sort: s.value })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Сброс */}
        {hasFilters && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                navigate("#/games");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Сбросить фильтры
            </Button>
          </div>
        )}
      </section>

      {/* Панель содержимого */}
      <div id="catalog-panel" role="tabpanel" aria-live="polite">
        {isScorecadeTab ? (
          <ScorecadePanel
            loading={topQuery.isLoading}
            error={topQuery.error?.message}
            items={topQuery.data?.items ?? []}
            onRetry={() => topQuery.refetch()}
          />
        ) : (
          <section aria-label="Игры каталога">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {searching
                  ? `Поиск: «${trimmed}»`
                  : (activeTab?.label ?? "Популярные сейчас")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {browseQuery.data
                  ? searching
                    ? `Нашлось ${total.toLocaleString("ru-RU")} — листайте вниз`
                    : `Показано ${items.length.toLocaleString("ru-RU")} из ${total.toLocaleString("ru-RU")}`
                  : (activeTab?.hint ?? "")}
              </p>
            </div>

            {browseQuery.isLoading ? (
              <CapsuleGridSkeleton count={12} />
            ) : browseQuery.error ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TriangleAlert
                    className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                  {browseQuery.error.message}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => browseQuery.refetch()}
                >
                  Повторить
                </Button>
              </div>
            ) : items.length === 0 ? (
              searching ? (
                <EmptyState
                  icon={SearchX}
                  title={`По запросу «${trimmed}» ничего не нашлось`}
                  hint="Попробуйте другое написание, латиницу вместо кириллицы или более короткий запрос."
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="В этой подборке сейчас нет игр"
                  hint="Так бывает, когда фильтр по платформе отсек всё. Сбросьте фильтры или выберите другую платформу."
                />
              )
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {items.map((it) => (
                    <GameCard
                      key={it.id}
                      item={it}
                      myStatus={myStatuses.get(it.id) ?? null}
                    />
                  ))}
                </div>

                {/* Прогресс подгрузки */}
                {total > 0 && items.length < total && (
                  <p className="mt-5 text-center text-xs text-muted-foreground">
                    Показано {items.length.toLocaleString("ru-RU")} из{" "}
                    {total.toLocaleString("ru-RU")}{" "}
                    {pluralRu(total, "игры", "игр", "игр")}
                  </p>
                )}

                {/* Сентинел бесконечной прокрутки + ручная кнопка */}
                <div
                  ref={sentinelRef}
                  aria-hidden
                  className="h-1 w-full"
                />
                {browseQuery.hasNextPage && (
                  <div className="mt-5 flex justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={browseQuery.isFetchingNextPage}
                      onClick={() => void browseQuery.fetchNextPage()}
                    >
                      {browseQuery.isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Загружаем ещё {50}…
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-4 w-4" aria-hidden />
                          Показать ещё
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {browseQuery.isFetchingNextPage && (
                  <div className="mt-5">
                    <CapsuleGridSkeleton count={6} />
                  </div>
                )}
                {!browseQuery.hasNextPage && items.length > 0 && (
                  <p className="mt-6 text-center text-xs text-muted-foreground">
                    {browseQuery.data?.pages[0]?.total === items.length
                      ? "Это все игры этой подборки"
                      : "Достигнута глубина листания источника — Steam отдаёт первые 10 000 позиций выдачи"}
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {/* Честные ограничения источника */}
      <p className="mt-8 rounded-xl border border-dashed border-border bg-card/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Источник данных — страница поиска магазина Steam: только игры (без DLC,
        демо и саундтреков), по 50 карточек на страницу, до 10 000 позиций
        выдачи. Цены и скидки — как в магазине Steam (регион US). Фильтры по
        жанру и году не показаны — источник не предоставляет достоверных данных
        для них. Бейджи «X.X · N оценок» — оценки пользователей {SITE_NAME}, а не
        Metacritic и не рейтинг Steam.
      </p>
    </div>
  );
}

/* ==================== Панели ==================== */

/** Топ Scorecade — собственный рейтинг проекта: отдельный endpoint
 *  (community-top), не смешивается со Steam-чартами. */
function ScorecadePanel({
  loading,
  error,
  items,
  onRetry,
}: {
  loading: boolean;
  error?: string;
  items: CommunityTopItem[];
  onRetry: () => void;
}) {
  return (
    <section aria-label="Топ игр по оценкам сообщества">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Топ Scorecade
        </h2>
        <p className="text-xs text-muted-foreground">
          не зависит от чартов и продаж Steam
        </p>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Рейтинг по оценкам пользователей {SITE_NAME}. Ранжирование: сначала
        игры с несколькими оценками (по средней), затем с одной.
      </p>

      {loading ? (
        <CoverGridSkeleton count={12} />
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert
              className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            {error}
          </p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Пока никто не поставил ни одной оценки"
          hint="Оцените первыми — и здесь появится рейтинг сообщества. Перейдите на главную и выберите игру."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((t, idx) => (
            <a key={t.gameId} href={`#/game/${t.gameId}`} className="group">
              <div className="relative overflow-hidden rounded-lg border border-border bg-card transition-colors group-hover:border-[var(--line-strong)]">
                <GameCover
                  cover={t.gameCover}
                  gameId={t.gameId}
                  name={t.gameName}
                  className="aspect-[2/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <span
                  aria-hidden
                  className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-black/70 text-[10px] font-extrabold text-white"
                >
                  {idx + 1}
                </span>
                <span className="absolute bottom-1.5 right-1.5 rounded border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                  {formatAverage(t.average)}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">
                {t.gameName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t.count}{" "}
                {pluralRu(t.count, "оценка", "оценки", "оценок")}
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

/** Пилюля-переключатель (платформа/сортировка). */
function FilterPill({
  label,
  icon: Icon,
  pressed,
  onClick,
}: {
  label: string;
  icon: typeof Monitor;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
        pressed
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
