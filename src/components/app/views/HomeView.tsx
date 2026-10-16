"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gamepad2,
  Search,
  SearchX,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SITE_NAME } from "@/lib/config";
import { GameCard } from "@/components/app/GameCard";
import { GameCover } from "@/components/app/GameCover";
import { EmptyState } from "@/components/app/EmptyState";
import { FollowButton } from "@/components/app/FollowButton";
import { UserAvatar } from "@/components/app/UserAvatar";
import { openGameModal, gameModalClickHandler } from "@/components/app/game-modal-store";
import { CapsuleGridSkeleton, ListSkeleton } from "@/components/app/Skeletons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  formatAverage,
  formatCountCompact,
  formatDateTime,
  pluralRu,
  timeAgo,
} from "@/lib/format";
import type {
  BrowseItem,
  BrowseResponse,
  BrowseSection,
  CommunityTopItem,
  FeedItem,
  GameStatusValue,
  LibraryItem,
  MostPlayedItem,
  StatusRow,
  UserSearchItem,
} from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

/** Сколько строк показывать в чарте и карточек в превью библиотеки. */
const CHART_ROWS = 10;
const LIBRARY_PREVIEW = 6;
/** Сколько событий друзей показывать на главной. */
const FRIEND_FEED_ITEMS = 5;

export function HomeView() {
  const { user, ready } = useAuth();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const trimmed = debounced.trim();
  const searching = trimmed.length >= 2;
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    document.title = `${SITE_NAME} — оценки игр из Steam`;
  }, []);

  // Поиск игр — полнотекстовый режим каталога Steam (та же выдача, что на
  // странице поиска магазина): до 50 игр на страницу. На главной показываем
  // первые 12 и ссылку «смотреть все» в каталог.
  const searchQuery = useQuery({
    queryKey: ["browseSearch", trimmed],
    queryFn: () =>
      api<BrowseResponse>(
        `/api/games/browse?q=${encodeURIComponent(trimmed)}&page=1`,
      ),
    enabled: searching,
    staleTime: 5 * 60 * 1000,
  });

  const usersQuery = useQuery({
    queryKey: ["userSearch", trimmed],
    queryFn: () =>
      api<{ items: UserSearchItem[] }>(
        `/api/users/search?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: searching,
    staleTime: 0, // follow-state must be fresh on remount
  });

  // Моя библиотека — для превью и панели «Добавь своё мнение».
  const libraryQuery = useQuery({
    queryKey: ["library"],
    queryFn: () => api<{ items: LibraryItem[] }>("/api/me/library"),
    enabled: !!user,
    staleTime: 30_000,
  });
  const statusesQuery = useQuery({
    queryKey: ["myStatuses"],
    queryFn: () => api<{ statuses: StatusRow[] }>("/api/me/statuses"),
    enabled: !!user,
    staleTime: Infinity,
  });
  const myStatuses = new Map(
    (statusesQuery.data?.statuses ?? []).map((s) => [s.gameId, s.status]),
  );

  const libraryItems = libraryQuery.data?.items ?? [];
  const recentLibrary = libraryItems.slice(0, LIBRARY_PREVIEW);
  const unrated = libraryItems.filter((it) => it.score === null).slice(0, 5);
  const unratedLeft = Math.max(
    0,
    libraryItems.filter((it) => it.score === null).length - unrated.length,
  );
  const ratedCount = libraryItems.filter((it) => it.score !== null).length;
  const averageMine =
    ratedCount > 0
      ? Math.round(
          (libraryItems.reduce(
            (sum, it) => sum + (it.score ?? 0),
            0,
          ) /
            ratedCount) *
            10,
        ) / 10
      : null;
  const recentReviews = libraryItems
    .filter((it): it is LibraryItem & { review: string } => !!it.review)
    .slice(0, 3);

  // Подборки витрины Steam — источник чарта на главной.
  const sectionQueries = {
    topsellers: useBrowseSectionQuery("topsellers"),
    new: useBrowseSectionQuery("new"),
    coming: useBrowseSectionQuery("coming"),
    specials: useBrowseSectionQuery("specials"),
  };

  // Чарт «Сейчас играют» — официальный Steam, обновляется каждые 5 минут.
  const mostPlayedQuery = useQuery({
    queryKey: ["mostPlayed"],
    queryFn: () =>
      api<{ items: MostPlayedItem[]; updatedAt: string }>(
        "/api/games/most-played",
      ),
    staleTime: 60_000,
  });

  // Собственный рейтинг проекта — вкладка чарта.
  const topQuery = useQuery({
    queryKey: ["communityTop"],
    queryFn: () => api<{ items: CommunityTopItem[] }>("/api/games/community-top"),
    staleTime: 60_000,
  });

  // Лента друзей (первые события — без бесконечной прокрутки).
  // Ключ отличен от ["feed"] бесконечной ленты: у useQuery и
  // useInfiniteQuery разная форма кэша, один ключ их конфликтует.
  const feedQuery = useQuery({
    queryKey: ["feedPreview"],
    queryFn: () => api<{ items: FeedItem[] }>("/api/feed"),
    enabled: !!user,
    staleTime: 30_000,
  });
  const friendFeed = (feedQuery.data?.items ?? []).slice(0, FRIEND_FEED_ITEMS);

  const gameItems = searchQuery.data?.items ?? [];
  const userItems = usersQuery.data?.items ?? [];
  const gamesLoaded = !searchQuery.isLoading && !searchQuery.error;
  const usersLoaded = !usersQuery.isLoading && !usersQuery.error;
  const nothingAtAll =
    searching && gamesLoaded && usersLoaded && gameItems.length === 0 && userItems.length === 0;

  return (
    <div className="animate-view-in">
      {/* Заголовок страницы + быстрые действия (референс v3, pagehead) */}
      <div className="pagehead">
        <div>
          <div className="overline">Личный игровой журнал</div>
          <h1>Игры, к которым хочется вернуться.</h1>
          <p className="subtext">
            Отмечай то, во что играл, сохраняй впечатления и находи следующую
            игру через Steam.
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setPickerOpen(true)}
          >
            ＋ Оценить игру
          </button>
          <a className="btn btn-quiet" href="#/games">
            Найти новую игру →
          </a>
        </div>
      </div>

      {/* Поиск (компактное поле, как .top-search в референсе) */}
      <section aria-label="Поиск игр" className="mb-7">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="global-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query.length > 0) {
                setQuery("");
                e.currentTarget.blur();
              } else if (e.key === "Enter" && searching) {
                window.location.hash = `#/games?q=${encodeURIComponent(trimmed)}`;
              }
            }}
            placeholder="Найти игру или пользователя…"
            aria-label="Поиск игр и пользователей"
            autoComplete="off"
            className="h-10 w-full rounded-[7px] border border-[var(--input)] bg-card pl-9 pr-10 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        {query.trim().length > 0 && !searching && (
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Введите минимум 2 символа
          </p>
        )}
      </section>

      {/* Результаты поиска / композиция главной */}
      {searching ? (
        <section aria-label="Результаты поиска" aria-live="polite">
          {!nothingAtAll && (
            <div className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Gamepad2 className="h-4 w-4 text-primary" aria-hidden />
                Игры
              </h2>
              <SearchResults
                loading={
                  searchQuery.isLoading ||
                  (searchQuery.isFetching && !searchQuery.data)
                }
                items={gameItems}
                total={searchQuery.data?.total ?? null}
                error={searchQuery.error?.message}
                query={trimmed}
                onRetry={() => searchQuery.refetch()}
                myStatuses={myStatuses}
                compactEmpty={usersLoaded && userItems.length > 0}
              />
            </div>
          )}
          {!nothingAtAll && (usersQuery.isLoading || userItems.length > 0) && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-4 w-4 text-primary" aria-hidden />
                Пользователи
              </h2>
              <UserSearchResults
                loading={
                  usersQuery.isLoading || (usersQuery.isFetching && !usersQuery.data)
                }
                items={userItems}
                error={usersQuery.error?.message}
                onRetry={() => usersQuery.refetch()}
              />
            </div>
          )}
          {nothingAtAll && (
            <EmptyState
              icon={SearchX}
              title={`По запросу «${trimmed}» ничего не нашлось`}
              hint="Попробуйте другое написание или более короткий запрос — например, Portal или Witcher. Так же ищутся никнеймы пользователей."
            />
          )}
        </section>
      ) : (
        <>
          {/* Верхний ряд: чарт Steam + быстрый оценщик (референс, home-top) */}
          <div className="home-top">
            <SteamChartPanel
              sectionQueries={sectionQueries}
              topQuery={topQuery}
              mostPlayedQuery={mostPlayedQuery}
            />
            <QuickRatePanel
              isAuthed={!!user}
              ready={ready}
              unrated={unrated}
              unratedLeft={unratedLeft}
              hasLibrary={libraryItems.length > 0}
              libraryLoading={libraryQuery.isLoading}
              onPick={() => setPickerOpen(true)}
            />
          </div>

          {/* Второй ряд: друзья + моя библиотека (референс, two-columns) */}
          <div className="section two-columns">
            <FriendsPanel
              isAuthed={!!user}
              items={friendFeed}
              loading={feedQuery.isLoading}
              error={feedQuery.error?.message}
              onRetry={() => feedQuery.refetch()}
            />
            <LibraryPreviewPanel
              isAuthed={!!user}
              items={recentLibrary}
              total={libraryItems.length}
              ratedCount={ratedCount}
              average={averageMine}
            />
          </div>

          {/* Мои последние отзывы (референс, нижняя секция) */}
          {user && recentReviews.length > 0 && (
            <section className="section panel" aria-label="Мои последние отзывы">
              <div className="section-head">
                <div>
                  <h2>Мои последние отзывы</h2>
                  <p>Твои оценки видны друзьям, если решишь поделиться ими.</p>
                </div>
                <a className="text-button" href="#/me">
                  Все отзывы →
                </a>
              </div>
              <div className="review-list">
                {recentReviews.map((r) => (
                  <a
                    key={r.gameId}
                    href={`#/game/${r.gameId}`}
                    onClick={gameModalClickHandler(r.gameId)}
                    className="review-entry"
                  >
                    <GameCover
                      cover={r.gameCover}
                      gameId={r.gameId}
                      name={r.gameName}
                      preferHeader
                      className="review-cover"
                    />
                    <span className="min-w-0">
                      <strong className="block truncate">{r.gameName}</strong>
                      <p className="line-clamp-2">{r.review}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70" title={formatDateTime(r.updatedAt)}>
                        {timeAgo(r.updatedAt)}
                      </p>
                    </span>
                    <span className="my-score">{r.score}/10</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Anonymous CTA */}
          {ready && !user && (
            <section className="section panel text-center">
              <h2 className="text-lg font-bold">
                Заведите аккаунт в {SITE_NAME}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Оценивайте игры, отмечайте «хочу сыграть», пишите отзывы и
                подписывайтесь на друзей.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <a href="#/register" className="btn btn-primary">
                  Создать аккаунт
                </a>
                <a href="#/login" className="btn btn-quiet">
                  Войти
                </a>
              </div>
            </section>
          )}
        </>
      )}

      {/* Быстрый выбор игры для оценки */}
      <RatePickerModal open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}

/* ==================== Чарт «Популярно в Steam» (референс, chart-list) ==================== */

type SectionQuery = ReturnType<typeof useBrowseSectionQuery>;
type MostPlayedQuery = ReturnType<
  typeof useQuery<{ items: MostPlayedItem[]; updatedAt: string }>
>;

const CHART_TABS: ReadonlyArray<{
  key: "players" | "topsellers" | "new" | "coming" | "specials" | "score";
  label: string;
  summary: string;
  desc: string;
}> = [
  {
    key: "players",
    label: "Сейчас играют",
    summary: "Самые играемые",
    desc: "текущий онлайн по данным Steam",
  },
  {
    key: "topsellers",
    label: "Лидеры продаж",
    summary: "Лидеры продаж",
    desc: "по продажам в магазине Steam",
  },
  { key: "new", label: "Новинки", summary: "Новинки Steam", desc: "недавно выпущенные игры" },
  { key: "coming", label: "Скоро выйдут", summary: "Скоро выйдут", desc: "предстоящие релизы" },
  { key: "specials", label: "Скидки", summary: "Текущие скидки", desc: "игры со скидкой прямо сейчас" },
  {
    key: "score",
    label: `Оценки ${SITE_NAME}`,
    summary: `Топ ${SITE_NAME}`,
    desc: `рейтинг по оценкам пользователей ${SITE_NAME}`,
  },
];

/** Панель чарта (референс, panel + chart-tabs + chart-list). */
function SteamChartPanel({
  sectionQueries,
  topQuery,
  mostPlayedQuery,
}: {
  sectionQueries: Record<"topsellers" | "new" | "coming" | "specials", SectionQuery>;
  topQuery: ReturnType<typeof useQuery<{ items: CommunityTopItem[] }>>;
  mostPlayedQuery: MostPlayedQuery;
}) {
  const [tab, setTab] = useState<(typeof CHART_TABS)[number]["key"]>("players");
  const meta = CHART_TABS.find((t) => t.key === tab)!;

  const isScore = tab === "score";
  const isPlayers = tab === "players";
  const sectionQ = isScore || isPlayers ? null : sectionQueries[tab];

  const loading = isScore
    ? topQuery.isLoading
    : isPlayers
      ? mostPlayedQuery.isLoading
      : sectionQ!.isLoading;
  const error = isScore
    ? topQuery.error?.message
    : isPlayers
      ? mostPlayedQuery.error?.message
      : sectionQ!.error?.message;
  const activeQuery = isScore ? topQuery : isPlayers ? mostPlayedQuery : sectionQ!;
  const updatedAt = isPlayers
    ? (mostPlayedQuery.data?.updatedAt ?? null)
    : isScore
      ? null
      : (sectionQ!.data?.updatedAt ?? null);

  const mostPlayed: MostPlayedItem[] = isPlayers
    ? (mostPlayedQuery.data?.items ?? []).slice(0, CHART_ROWS)
    : [];
  const browseItems: BrowseItem[] =
    isScore || isPlayers
      ? []
      : (sectionQ!.data?.items ?? []).slice(0, CHART_ROWS);
  const scoreItems: CommunityTopItem[] = isScore
    ? (topQuery.data?.items ?? []).slice(0, CHART_ROWS)
    : [];
  const empty =
    !loading && !error && (
      isPlayers
        ? mostPlayed.length === 0
        : isScore
          ? scoreItems.length === 0
          : browseItems.length === 0
    );

  return (
    <section className="panel flex flex-col" aria-label="Популярно в Steam">
      <div className="panel-heading">
        <div>
          <h2>Популярно в Steam</h2>
          <p>Ориентир для поиска следующей игры — не рейтинг качества.</p>
        </div>
        <span className="source-label">
          {isScore ? SITE_NAME : "Steam · витрина"}
        </span>
      </div>

      {/* Вкладки чарта (референс, chart-tabs) */}
      <div className="chart-tabs" role="tablist" aria-label="Тип подборки">
        {CHART_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={"tab-button" + (tab === t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Пояснение активной вкладки (референс, chart-summary) */}
      <div className="chart-summary">
        <strong>{meta.summary}</strong>
        <span>·</span>
        <span>{meta.desc}</span>
        {updatedAt && (
          <>
            <span>·</span>
            <span title={formatDateTime(updatedAt)}>
              обновлено {timeAgo(updatedAt)}
            </span>
          </>
        )}
      </div>

      {/* Строки чарта */}
      <div className="flex min-w-0 flex-1 flex-col">
        {loading ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-background/40 p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <TriangleAlert
                className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              {error}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => activeQuery.refetch()}
            >
              Повторить
            </Button>
          </div>
        ) : empty ? (
          <p className="my-3 rounded-lg border border-dashed border-[var(--line-strong)] px-4 py-4 text-center text-xs text-muted-foreground">
            Steam пока не вернул данные для этой подборки. Загляните позже или
            откройте каталог.
          </p>
        ) : isPlayers ? (
          <ol className="chart-list stagger">
            {mostPlayed.map((it, idx) => (
              <ChartRow
                key={it.id}
                gameId={it.id}
                name={it.name}
                cover={it.cover}
                rank={idx + 1}
                sub={`пик сегодня · ${formatCountCompact(it.peak)}`}
                metric={formatCountCompact(it.players)}
                metricSub="сейчас играют"
                metricAccent
              />
            ))}
          </ol>
        ) : isScore ? (
          <ol className="chart-list stagger">
            {scoreItems.map((t, idx) => (
              <ChartRow
                key={t.gameId}
                gameId={t.gameId}
                name={t.gameName}
                cover={t.gameCover}
                rank={idx + 1}
                sub={`${t.count} ${pluralRu(t.count, "оценка", "оценки", "оценок")} ${SITE_NAME}`}
                metric={formatAverage(t.average)}
                metricSub="из 10"
              />
            ))}
          </ol>
        ) : (
          <ol className="chart-list stagger">
            {browseItems.map((it, idx) => (
              <ChartRow
                key={it.id}
                gameId={it.id}
                name={it.name}
                cover={it.header || it.cover}
                rank={it.rank ?? idx + 1}
                sub={it.reviewSummary ?? it.released ?? ""}
                metric={
                  it.discountPercent !== null && it.price
                    ? it.price
                    : (it.price ?? "—")
                }
                metricSub={
                  it.discountPercent !== null
                    ? `−${it.discountPercent}%`
                    : it.isFree
                      ? "free to play"
                      : undefined
                }
                metricAccent={it.discountPercent !== null}
              />
            ))}
          </ol>
        )}
      </div>

      {/* Ссылка в каталог */}
      {!isPlayers && !isScore && !error && (
        <a
          href={`#/games?section=${tab}`}
          className="mt-3 shrink-0 self-end text-button"
        >
          Смотреть все →
        </a>
      )}

      <p className="data-note">
        Данные — витрина Steam (чарты и страница поиска магазина). Онлайн
        игроков приходит с официального Web API Valve; кэш на сервере —
        несколько минут, поэтому цифры могут чуть отставать.
      </p>
    </section>
  );
}

/** Одна строка чарта (референс, chart-row): место, капсула, название, метрика. */
function ChartRow({
  gameId,
  name,
  cover,
  rank,
  sub,
  metric,
  metricSub,
  metricAccent,
}: {
  gameId: string;
  name: string;
  cover: string | null;
  rank: number;
  sub: string;
  metric: string;
  metricSub?: string;
  metricAccent?: boolean;
}) {
  return (
    <li>
      <a
        href={`#/game/${gameId}`}
        onClick={gameModalClickHandler(gameId)}
        aria-label={`${name} — открыть окно игры`}
        className="chart-row group"
      >
        <span className="rank">{rank}</span>
        <GameCover
          cover={cover}
          gameId={gameId}
          name={name}
          preferHeader
          className="chart-cover transition-transform duration-200 group-hover:scale-[1.04]"
        />
        <span className="min-w-0">
          <span className="chart-name">{name}</span>
          {sub && <span className="chart-genre">{sub}</span>}
        </span>
        <span className="chart-metric">
          <b className={metricAccent ? "text-primary" : undefined}>{metric}</b>
          {metricSub && <small>{metricSub}</small>}
        </span>
      </a>
    </li>
  );
}

function ChartSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[24px_74px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5">
          <div className="h-3 w-4 animate-pulse rounded bg-secondary" />
          <div className="h-[35px] w-[74px] animate-pulse rounded bg-secondary" />
          <div className="space-y-1.5">
            <div className="h-3 w-3/5 animate-pulse rounded bg-secondary" />
            <div className="h-2.5 w-2/5 animate-pulse rounded bg-secondary" />
          </div>
          <div className="h-3 w-10 animate-pulse rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

/* ==================== «Добавь своё мнение» (референс, quick-rate) ==================== */

function QuickRatePanel({
  isAuthed,
  ready,
  unrated,
  unratedLeft,
  hasLibrary,
  libraryLoading,
  onPick,
}: {
  isAuthed: boolean;
  ready: boolean;
  unrated: LibraryItem[];
  unratedLeft: number;
  hasLibrary: boolean;
  libraryLoading: boolean;
  onPick: () => void;
}) {
  return (
    <section className="panel quick-rate" aria-label="Добавь своё мнение">
      <div className="panel-heading">
        <div>
          <h2>Добавь своё мнение</h2>
          <p>Отмечённые игры, которым ещё не хватает оценки.</p>
        </div>
        {isAuthed && <span className="source-label">Твоя библиотека</span>}
      </div>

      <p className="quick-rate-intro">
        Сайт не отслеживает игровые часы и прохождение автоматически. Ты сам
        отмечаешь игру и сохраняешь оценку или отзыв.
      </p>

      <div className="flex min-h-0 flex-1 flex-col">
        {!ready ? null : !isAuthed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--line-strong)] px-4 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Оценки и отметки сохраняются в аккаунте — вместе с библиотекой и
              лентой друзей.
            </p>
            <div className="flex gap-2">
              <a href="#/register" className="btn btn-primary">
                Создать аккаунт
              </a>
              <a href="#/login" className="btn btn-quiet">
                Войти
              </a>
            </div>
          </div>
        ) : libraryLoading ? (
          <ChartSkeleton />
        ) : unrated.length === 0 ? (
          <p className="quick-empty flex flex-1 items-center justify-center text-center">
            {hasLibrary
              ? "Все отмеченные игры уже оценены — так держать! Найди следующую в чарте слева."
              : "Отметь первую игру: найди её через поиск или каталог — и сохрани свою оценку."}
          </p>
        ) : (
          <div className="quick-list stagger">
            {unrated.map((it) => (
              <div key={it.gameId} className="quick-item">
                <button
                  type="button"
                  onClick={() => openGameModal(it.gameId)}
                  className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-label={`${it.gameName} — открыть окно игры`}
                >
                  <GameCover
                    cover={it.gameCover}
                    gameId={it.gameId}
                    name={it.gameName}
                    preferHeader
                    className="quick-cover transition-transform duration-200 group-hover:scale-[1.06]"
                  />
                  <span className="quick-info">
                    <strong className="transition-colors group-hover:text-primary">
                      {it.gameName}
                    </strong>
                    <small>
                      {it.status ? STATUS_LABELS[it.status] : "без отметки"}
                      {" · "}
                      {timeAgo(it.updatedAt)}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-tiny"
                  onClick={() => openGameModal(it.gameId)}
                >
                  Оценить
                </button>
              </div>
            ))}
          </div>
        )}
        {isAuthed && unratedLeft > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            …и ещё {unratedLeft}{" "}
            {pluralRu(unratedLeft, "игра", "игры", "игр")} без оценки
          </p>
        )}
      </div>

      {isAuthed && (
        <div className="mt-auto shrink-0 pt-3.5">
          <button type="button" className="btn btn-primary w-full" onClick={onPick}>
            Выбрать игру для оценки
          </button>
        </div>
      )}
    </section>
  );
}

/* ==================== «Что понравилось друзьям» (референс, feed) ==================== */

function FriendsPanel({
  isAuthed,
  items,
  loading,
  error,
  onRetry,
}: {
  isAuthed: boolean;
  items: FeedItem[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <section className="panel" aria-label="Что понравилось друзьям">
      <div className="panel-heading">
        <div>
          <h2>Что понравилось друзьям</h2>
          <p>Последние оценки и короткие отзывы — то, ради чего стоит заглянуть.</p>
        </div>
        {isAuthed && (
          <a href="#/feed" className="text-button">
            Вся лента →
          </a>
        )}
      </div>

      {!isAuthed ? (
        <p className="empty-note text-center">
          Войдите — и здесь появятся оценки и отзывы людей, на которых вы
          подписаны.
        </p>
      ) : loading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-background/40 p-4">
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
        <p className="empty-note text-center">
          Пока пусто: подпишитесь на друзей — их оценки появятся здесь. Найти
          людей можно поиском по никнейму.
        </p>
      ) : (
        <div className="feed stagger">
          {items.map((f) => (
            <article
              key={`${f.username}-${f.gameId}`}
              className="feed-item"
            >
              <a href={`#/u/${f.username}`} className="shrink-0" aria-label={`Профиль ${f.username}`}>
                <UserAvatar username={f.username} src={f.avatarUrl} size="sm" />
              </a>
              <div className="feedtext min-w-0">
                <a href={`#/u/${f.username}`} className="font-bold hover:text-primary">
                  {f.username}
                </a>{" "}
                оценил(а){" "}
                <a
                  href={`#/game/${f.gameId}`}
                  onClick={gameModalClickHandler(f.gameId)}
                  className="font-bold hover:text-primary"
                >
                  {f.gameName}
                </a>
                {f.review && <p>«{f.review}»</p>}
                <p className="!mt-0.5 text-[10px] text-muted-foreground/70" title={formatDateTime(f.updatedAt)}>
                  {timeAgo(f.updatedAt)}
                </p>
              </div>
              <div className="feedrating">{f.score}/10</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ==================== «Твоя библиотека» (референс, mini-library) ==================== */

function LibraryPreviewPanel({
  isAuthed,
  items,
  total,
  ratedCount,
  average,
}: {
  isAuthed: boolean;
  items: LibraryItem[];
  total: number;
  ratedCount: number;
  average: number | null;
}) {
  return (
    <section className="panel" aria-label="Моя библиотека">
      <div className="panel-heading">
        <div>
          <h2>Твоя библиотека</h2>
          <p>Только то, что ты сам добавил или отметил.</p>
        </div>
        {isAuthed && (
          <a href="#/library" className="text-button">
            Открыть →
          </a>
        )}
      </div>

      {!isAuthed ? (
        <p className="empty-note text-center">
          Библиотека — это твой ручной список: отмечай «хочу сыграть», ставь
          оценки и пиши впечатления.
        </p>
      ) : items.length === 0 ? (
        <p className="empty-note text-center">
          Здесь пока пусто. Найди игру в каталоге и отметь её — она появится в
          библиотеке.
        </p>
      ) : (
        <>
          <div className="library-summary">
            <span>
              <strong>{total}</strong>
              {pluralRu(total, "игра", "игры", "игр")}
            </span>
            <span>
              <strong>{ratedCount}</strong>
              {pluralRu(ratedCount, "оценка", "оценки", "оценок")}
            </span>
            {average !== null && (
              <span>
                <strong className="!text-primary">{formatAverage(average)}</strong>
                средняя
              </span>
            )}
          </div>
          <div className="mini-library stagger">
            {items.map((it) => (
              <button
                key={it.gameId}
                type="button"
                onClick={() => openGameModal(it.gameId)}
                className="mini-game text-left"
                aria-label={`${it.gameName} — открыть окно игры`}
              >
                <GameCover
                  cover={it.gameCover}
                  gameId={it.gameId}
                  name={it.gameName}
                  preferHeader
                  className="mini-cover"
                />
                <strong>{it.gameName}</strong>
                <small>
                  {it.score !== null
                    ? `${it.score}/10`
                    : it.status
                      ? STATUS_LABELS[it.status]
                      : "без оценки"}
                </small>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ==================== Быстрый выбор игры («Оценить игру») ==================== */

function RatePickerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 350);
  const trimmed = debounced.trim();
  const searching = trimmed.length >= 2;

  // Сброс строки при закрытии — синхронизация во время рендера
  // (паттерн «adjust state when props change», без эффекта).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery("");
  }

  const resultsQuery = useQuery({
    queryKey: ["browseSearch", trimmed],
    queryFn: () =>
      api<BrowseResponse>(
        `/api/games/browse?q=${encodeURIComponent(trimmed)}&page=1`,
      ),
    enabled: open && searching,
    staleTime: 5 * 60 * 1000,
  });

  const items = resultsQuery.data?.items.slice(0, 8) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[50%] max-h-[85vh] gap-0 overflow-y-auto rounded-xl border-border bg-card p-0 sm:max-w-[570px]"
      >
        <div className="border-b border-border p-4">
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            Твоя библиотека
          </p>
          <DialogTitle className="text-lg font-bold">
            Какую игру оценим?
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Найдите игру по названию — откроется компактное окно с оценкой,
            отметкой и отзывом.
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название игры…"
            aria-label="Поиск игры для оценки"
            autoFocus
            className="mt-3 h-10 w-full rounded-md border border-[var(--input)] bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!searching ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Введите минимум 2 символа — например, Hades или Witcher.
            </p>
          ) : resultsQuery.isLoading ? (
            <ListSkeleton count={3} />
          ) : resultsQuery.error ? (
            <p className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
              <TriangleAlert
                className="h-4 w-4 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              {resultsQuery.error.message}
            </p>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Ничего не нашлось. Проверьте написание.
            </p>
          ) : (
            <ul>
              {items.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      openGameModal(g.id);
                    }}
                    className="grid w-full grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50"
                  >
                    <GameCover
                      cover={g.cover}
                      header={g.header}
                      gameId={g.id}
                      name={g.name}
                      className="aspect-[460/215] w-20 rounded border border-border object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {g.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {[g.released, g.price].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {g.scorecade ? (
                      <span className="shrink-0 text-xs font-extrabold text-primary">
                        {formatAverage(g.scorecade.average)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== Результаты поиска ==================== */

function SearchResults({
  loading,
  items,
  total,
  error,
  query,
  onRetry,
  myStatuses,
  compactEmpty,
}: {
  loading: boolean;
  items: BrowseItem[];
  total: number | null;
  error?: string;
  query: string;
  onRetry: () => void;
  myStatuses: Map<string, GameStatusValue>;
  /** Games not found but users exist → small inline note instead of a big empty state. */
  compactEmpty?: boolean;
}) {
  if (loading) return <CapsuleGridSkeleton count={12} />;
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/40 p-4">
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
    );
  }
  if (items.length === 0) {
    if (compactEmpty) {
      return (
        <p className="rounded-lg border border-dashed border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
          Игр по запросу «{query}» не нашлось — но смотрите раздел
          «Пользователи» ниже.
        </p>
      );
    }
    return null;
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.slice(0, 12).map((item) => (
          <GameCard
            key={item.id}
            item={item}
            myStatus={myStatuses.get(item.id) ?? null}
          />
        ))}
      </div>
      {(items.length > 12 || (total ?? 0) > items.length) && (
        <a href={`#/games?q=${encodeURIComponent(query)}`} className="btn btn-quiet mt-4">
          {total != null && total > items.length
            ? `Все ${total} ${pluralRu(total, "игра", "игры", "игр")} в каталоге`
            : "Смотреть в каталоге"}
          {" →"}
        </a>
      )}
    </>
  );
}

function UserSearchResults({
  loading,
  items,
  error,
  onRetry,
}: {
  loading: boolean;
  items: UserSearchItem[];
  error?: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-2">
        <ListSkeleton count={3} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/40 p-4">
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
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
        Пользователей с таким никнеймом не нашлось.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((u) => (
        <li
          key={u.username}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-[var(--line-strong)]"
        >
          <a
            href={`#/u/${u.username}`}
            className="flex min-w-0 flex-1 items-center gap-3"
            title={u.isMe ? "Это ваш профиль" : `Профиль ${u.username}`}
          >
            <UserAvatar username={u.username} src={u.avatarUrl} size="md" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold">{u.username}</span>
                {u.isMe && (
                  <span className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">
                    это вы
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {u.ratings}{" "}
                {pluralRu(u.ratings, "оценка", "оценки", "оценок")} ·{" "}
                {u.followers}{" "}
                {pluralRu(u.followers, "подписчик", "подписчика", "подписчиков")}
              </span>
            </span>
          </a>
          {!u.isMe && (
            <FollowButton
              username={u.username}
              initialFollowing={u.isFollowing}
              size="sm"
              className="shrink-0"
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/* ==================== Подборки витрины Steam (каталог, страница 1) ==================== */

/** Запрос первой страницы каталога для вкладки чарта на главной. */
function useBrowseSectionQuery(section: BrowseSection) {
  return useQuery({
    queryKey: ["browseSection", section],
    queryFn: () =>
      api<BrowseResponse>(`/api/games/browse?section=${section}&page=1`),
    staleTime: 10 * 60 * 1000,
  });
}
