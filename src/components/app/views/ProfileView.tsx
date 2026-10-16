"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookmarkPlus,
  Camera,
  Clock3,
  Gamepad2,
  History,
  ImagePlus,
  Loader2,
  LogOut,
  PenLine,
  Share2,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useCountUp } from "@/hooks/use-count-up";
import { ImageCropDialog } from "@/components/app/ImageCropDialog";
import { formatAverage, formatDate, formatDateTime, pluralRu, timeAgo } from "@/lib/format";
import { SITE_NAME } from "@/lib/config";
import { GameCover } from "@/components/app/GameCover";
import { LibraryMiniCard } from "@/components/app/GameCard";
import { ScoreBadge } from "@/components/app/ScoreBadge";
import { ReviewActions } from "@/components/app/ReviewActions";
import { UserAvatar } from "@/components/app/UserAvatar";
import { FollowButton } from "@/components/app/FollowButton";
import { Achievements } from "@/components/app/Achievements";
import { ExportRatingsButton } from "@/components/app/ExportRatingsButton";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { FriendsFeed } from "@/components/app/views/FeedView";
import { Button } from "@/components/ui/button";
import type { AuthUser, ProfileResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALLOWED_PIC_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_MB = 4;
const MAX_BANNER_MB = 8;

type PictureType = "avatar" | "banner";

/** Сколько игр в «лучших оценках» и отзывов в превью профиля. */
const BEST_COUNT = 6;
const REVIEWS_PREVIEW = 4;

export function ProfileView({
  username,
  isMe = false,
}: {
  username: string;
  isMe?: boolean;
}) {
  const { logout, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | number>("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [tab, setTab] = useState<"ratings" | "wants">("ratings");
  // Верхняя вкладка профиля: «Профиль» / «Друзья» (только для своего). 
  const [mainTab, setMainTab] = useState<"overview" | "friends">("overview");

  // ---- avatar / banner uploads (kappa.lol, own profile only) ----
  const [picBusy, setPicBusy] = useState<PictureType | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  // Файл в диалоге кадрирования (обрезка + перемещение перед загрузкой).
  const [cropFile, setCropFile] = useState<{ type: PictureType; file: File } | null>(
    null,
  );

  useEffect(() => {
    document.title = `${username} — ${SITE_NAME}`;
  }, [username]);

  const profileQuery = useQuery({
    queryKey: ["profile", username],
    queryFn: () =>
      api<ProfileResponse>(`/api/users/${encodeURIComponent(username)}`),
    retry: 1,
  });

  // Мои подписки — для вкладки «Друзья» (только собственный профиль).
  const followingQuery = useQuery({
    queryKey: ["following", username.toLowerCase()],
    queryFn: () =>
      api<{ items: Array<{ username: string; avatarUrl: string | null }> }>(
        `/api/users/${encodeURIComponent(username)}/following`,
      ),
    enabled: isMe,
    staleTime: 30_000,
  });

  const data = profileQuery.data;
  const ratings = data?.ratings ?? [];
  const wants = data?.wants ?? [];
  const distribution = data?.user.stats.distribution ?? [];
  const maxCount = Math.max(1, ...distribution);

  const filtered = useMemo(
    () => (filter === "all" ? ratings : ratings.filter((r) => r.score === filter)),
    [ratings, filter],
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "old":
        return list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      case "best":
        return list.sort(
          (a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt),
        );
      case "worst":
        return list.sort(
          (a, b) => a.score - b.score || b.updatedAt.localeCompare(a.updatedAt),
        );
      default:
        return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  }, [filtered, sort]);

  // Лучшие оценки и последние отзывы — превью в стиле референса v3.
  const bestRated = useMemo(
    () =>
      [...ratings]
        .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, BEST_COUNT),
    [ratings],
  );
  const myReviews = useMemo(
    () => ratings.filter((r) => r.review).slice(0, REVIEWS_PREVIEW),
    [ratings],
  );

  if (profileQuery.isLoading) {
    return (
      <div className="py-6">
        <div className="flex items-center gap-4">
          <ListSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (profileQuery.error || !data) {
    return (
      <div className="py-8">
        <EmptyState
          icon={UserX}
          title="Пользователь не найден"
          hint="Проверьте ссылку — возможно, в никнейме опечатка."
          action={
            <Button asChild variant="secondary">
              <a href="#/">На главную</a>
            </Button>
          }
        />
      </div>
    );
  }

  const user = data.user;

  /** Apply a freshly uploaded/removed picture everywhere it is cached. */
  const applyPictureUser = (next: AuthUser) => {
    updateUser(next);
    queryClient.setQueryData<ProfileResponse>(["profile", user.username], (old) =>
      old
        ? {
            ...old,
            user: {
              ...old.user,
              avatarUrl: next.avatarUrl,
              bannerUrl: next.bannerUrl,
            },
          }
        : old,
    );
    void queryClient.invalidateQueries({ queryKey: ["userSearch"] });
  };

  const uploadPicture = async (type: PictureType, file: File) => {
    if (!ALLOWED_PIC_TYPES.has(file.type)) {
      toast.error("Поддерживаются форматы PNG, JPEG, WebP и GIF.");
      return;
    }
    const maxMb = type === "avatar" ? MAX_AVATAR_MB : MAX_BANNER_MB;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Файл слишком большой — максимум ${maxMb} МБ.`);
      return;
    }
    setPicBusy(type);
    try {
      // Файл уже обработан в диалоге кадрирования (обрезан и пережат —
      // аватар 256×256, баннер 1600×320); GIF загружается как есть.
      const form = new FormData();
      form.append("type", type);
      form.append("file", file);
      const res = await api<{ user: AuthUser }>("/api/me/picture", {
        method: "POST",
        body: form,
      });
      applyPictureUser(res.user);
      toast(type === "avatar" ? "Аватарка обновлена" : "Баннер обновлён");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось загрузить изображение",
      );
    } finally {
      setPicBusy(null);
    }
  };

  const removePicture = async (type: PictureType) => {
    setPicBusy(type);
    try {
      const res = await api<{ user: AuthUser }>(`/api/me/picture?type=${type}`, {
        method: "DELETE",
      });
      applyPictureUser(res.user);
      toast(type === "avatar" ? "Аватарка убрана" : "Баннер убран");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не получилось удалить изображение",
      );
    } finally {
      setPicBusy(null);
    }
  };

  const handlePicSelect = (
    type: PictureType,
    files: FileList | null,
  ) => {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED_PIC_TYPES.has(file.type)) {
      toast.error("Поддерживаются форматы PNG, JPEG, WebP и GIF.");
      return;
    }
    const maxMb = type === "avatar" ? MAX_AVATAR_MB : MAX_BANNER_MB;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Файл слишком большой — максимум ${maxMb} МБ.`);
      return;
    }
    // GIF нельзя обрезать (canvas убил бы анимацию) — загружаем как есть.
    if (file.type === "image/gif") {
      void uploadPicture(type, file);
      return;
    }
    // Всё остальное — сначала диалог кадрирования: подвинуть и приблизить.
    setCropFile({ type, file });
  };

  const shareProfile = async () => {
    // Always share the canonical #/u/<username> link — never window.location
    // (viewing your own profile via #/me would copy "#/me", which opens the
    // RECIPIENT's own profile instead of yours).
    const url = `${window.location.origin}/#/u/${encodeURIComponent(user.username)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${user.username} — ${SITE_NAME}`,
          text: `Профиль ${user.username} в ${SITE_NAME}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Ссылка на профиль скопирована");
    } catch {
      /* share sheet dismissed — not an error */
    }
  };

  return (
    <div className="py-6">
      {/* Шапка страницы (референс v3, pagehead): надзаголовок, заголовок,
          подпись и действия. Настройки — только шестерёнкой в хедере сайта. */}
      <section className="animate-rise-in mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            {isMe ? "Твой игровой вкус" : "Игровой вкус"}
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Профиль
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {isMe
              ? "Игровая история и мнения друзей — в одном месте."
              : `Оценки и отзывы ${user.username} в ${SITE_NAME}.`}
          </p>
        </div>
        {isMe ? (
          <div className="flex flex-wrap gap-2">
            <ExportRatingsButton
              username={user.username}
              ratings={ratings}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void shareProfile()}
              aria-label="Поделиться профилем"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Поделиться</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                toast("Вы вышли из аккаунта");
                window.location.hash = "#/";
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Выйти
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void shareProfile()}
              aria-label="Поделиться профилем"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Поделиться</span>
            </Button>
            <FollowButton
              username={user.username}
              initialFollowing={user.isFollowing}
              size="default"
            />
          </div>
        )}
      </section>

      {/* Панель профиля (как в Steam): баннер на всю ширину, слева — аватар
          и имя, справа сбоку — плитки статистики (оценки, средняя,
          подписчики, подписки). */}
      <section className="animate-rise-in overflow-hidden rounded-[10px] border border-border bg-card">
        {/* Banner */}
        <div className="relative h-28 sm:h-36 lg:h-44">
          {user.bannerUrl ? (
            <img
              src={user.bannerUrl}
              alt={`Баннер профиля ${user.username}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="h-full w-full bg-gradient-to-r from-primary/15 via-primary/5 to-transparent"
            />
          )}
          {isMe && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {user.bannerUrl && (
                <button
                  type="button"
                  onClick={() => void removePicture("banner")}
                  disabled={picBusy !== null}
                  aria-label="Убрать баннер"
                  title="Убрать баннер"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/75 text-muted-foreground backdrop-blur-sm transition-colors hover:border-destructive/60 hover:text-destructive"
                >
                  {picBusy === "banner" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={picBusy !== null}
                aria-label="Загрузить баннер"
                title="Загрузить баннер"
                className="flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/75 px-3 text-xs font-bold text-foreground/85 backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-primary"
              >
                {picBusy === "banner" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">Баннер</span>
              </button>
            </div>
          )}
        </div>

        {/* Аватар + имя (слева) и статистика (справа сбоку, Steam) */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-4 px-5 sm:flex-row sm:items-center lg:pb-5">
            <div className="relative -mt-10 shrink-0 sm:-mt-12">
              <UserAvatar
                username={user.username}
                src={user.avatarUrl}
                size="xl"
                className="ring-4 ring-card"
              />
              {isMe && (
                <div className="absolute -bottom-1.5 -right-1 flex items-center gap-1.5">
                  {user.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => void removePicture("avatar")}
                      disabled={picBusy !== null}
                      aria-label="Убрать аватарку"
                      title="Убрать аватарку"
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-muted-foreground shadow-md transition-colors hover:text-destructive"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={picBusy !== null}
                    aria-label="Загрузить аватарку"
                    title="Загрузить аватарку"
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
                  >
                    {picBusy === "avatar" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Camera className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {user.username}
                </h2>
                {isMe && (
                  <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    это вы
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                В {SITE_NAME} с {formatDate(user.createdAt)}
              </p>
            </div>
          </div>

          {/* Статистика — справа сбоку, плитки как в Steam */}
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 lg:p-5 lg:pl-0">
            <StatCard
              label={pluralRu(user.stats.count, "оценка", "оценки", "оценок")}
              value={String(user.stats.count)}
              icon={Gamepad2}
            />
            <StatCard
              label="средняя"
              value={formatAverage(user.stats.average)}
              icon={Star}
              plain
            />
            <StatCard
              label={pluralRu(user.followers, "подписчик", "подписчика", "подписчиков")}
              value={String(user.followers)}
              icon={Users}
              href={`#/u/${user.username}/followers`}
              ariaLabel={`Подписчики ${user.username}: ${user.followers}`}
            />
            <StatCard
              label={pluralRu(user.following, "подписка", "подписки", "подписок")}
              value={String(user.following)}
              icon={UserPlus}
              href={`#/u/${user.username}/following`}
              ariaLabel={`Подписки ${user.username}: ${user.following}`}
            />
          </div>
        </div>
      </section>

      {/* Hidden file pickers (own profile only) */}
      {isMe && (
        <>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              handlePicSelect("avatar", e.target.files);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              handlePicSelect("banner", e.target.files);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
          {/* Кадрирование перед загрузкой: подвинуть, приблизить, сохранить */}
          <ImageCropDialog
            open={!!cropFile}
            file={cropFile?.file ?? null}
            kind={cropFile?.type ?? "avatar"}
            busy={!!cropFile && picBusy === cropFile.type}
            onConfirm={(f) => {
              const t = cropFile!.type;
              setCropFile(null);
              void uploadPicture(t, f);
            }}
            onCancel={() => setCropFile(null)}
          />
        </>
      )}

      {/* Верхние вкладки: Профиль / Друзья (только для своего профиля) */}
      {isMe && (
        <nav
          aria-label="Разделы профиля"
          className="mt-5 flex gap-1 border-b border-border"
        >
          <button
            type="button"
            aria-pressed={mainTab === "overview"}
            onClick={() => setMainTab("overview")}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors",
              mainTab === "overview"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Мой профиль
          </button>
          <button
            type="button"
            aria-pressed={mainTab === "friends"}
            onClick={() => setMainTab("friends")}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors",
              mainTab === "friends"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Друзья и их отзывы
            <span className="rounded bg-secondary px-1.5 py-px text-[10px] font-bold tabular-nums text-muted-foreground">
              {user.following}
            </span>
          </button>
        </nav>
      )}

      {isMe && mainTab === "friends" ? (
        <ProfileFriendsTab
          following={followingQuery.data?.items ?? []}
          loading={followingQuery.isLoading}
          error={followingQuery.error?.message}
          onRetry={() => followingQuery.refetch()}
        />
      ) : (
        <>
      {/* Achievements (arcade badges computed from public stats) */}
      <Achievements user={user} />

      {/* Лучшие оценки + мои отзывы (референс v3, two-columns) */}
      {ratings.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section
            aria-label="Лучшие оценки"
            className="animate-rise-in rounded-[10px] border border-border bg-card p-4 md:p-[17px]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold leading-snug">
                  {isMe ? "Мои лучшие оценки" : `Лучшие оценки`}
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {isMe
                    ? "Игры, которые я охотнее всего рекомендую."
                    : "Игры, которые охотнее всего рекомендуют."}
                </p>
              </div>
              {isMe && (
                <a
                  href="#/library"
                  className="shrink-0 text-[11px] font-bold text-primary hover:underline"
                >
                  Библиотека →
                </a>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {bestRated.map((r) => (
                <LibraryMiniCard
                  key={r.gameId}
                  gameId={r.gameId}
                  gameName={r.gameName}
                  gameCover={r.gameCover}
                  score={r.score}
                  status={null}
                />
              ))}
            </div>
          </section>

          <section
            aria-label="Мои отзывы"
            className="animate-rise-in rounded-[10px] border border-border bg-card p-4 md:p-[17px]"
            style={{ animationDelay: "0.07s" }}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold leading-snug">
                  {isMe ? "Мои отзывы" : "Отзывы"}
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  Короткие впечатления, которые помогут друзьям с выбором.
                </p>
              </div>
            </div>
            {myReviews.length === 0 ? (
              <p className="my-3 rounded-lg border border-dashed border-[var(--line-strong)] px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground">
                {isMe
                  ? "Пока без текстовых отзывов — оставь первое впечатление на странице игры."
                  : "Пока без текстовых отзывов."}
              </p>
            ) : (
              <ul>
                {myReviews.map((r) => (
                  <li
                    key={r.gameId}
                    className="grid grid-cols-[78px_minmax(0,1fr)_auto] items-start gap-3 border-b border-border py-3 last:border-b-0 last:pb-1 first:pt-2"
                  >
                    <a
                      href={`#/game/${r.gameId}`}
                      aria-label={`Открыть игру ${r.gameName}`}
                      className="shrink-0"
                    >
                      <GameCover
                        cover={r.gameCover}
                        gameId={r.gameId}
                        name={r.gameName}
                        preferHeader
                        className="aspect-[16/9] w-[78px] rounded border border-border object-cover transition-transform duration-200 hover:scale-[1.04]"
                      />
                    </a>
                    <div className="min-w-0">
                      <a
                        href={`#/game/${r.gameId}`}
                        className="block truncate text-xs font-bold hover:text-primary"
                      >
                        {r.gameName}
                      </a>
                      <p className="mt-1 line-clamp-3 break-words text-[11px] leading-relaxed text-muted-foreground">
                        {r.review}
                      </p>
                      <p
                        className="mt-1 text-[10px] text-muted-foreground/70"
                        title={formatDateTime(r.updatedAt)}
                      >
                        {timeAgo(r.updatedAt)}
                      </p>
                    </div>
                    <span className="text-[11px] font-extrabold tabular-nums text-primary">
                      {r.score}/10
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Кнопка библиотеки — только в своём профиле */}
      {isMe && (
        <div className="mt-4">
          <Button asChild variant="secondary" size="sm">
            <a href="#/library">
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Библиотека: игры, отметки и отзывы
            </a>
          </Button>
        </div>
      )}

      {/* Ratings / wants tabs */}
      <div
        role="tablist"
        aria-label="Списки профиля"
        className="mt-4 grid grid-cols-2 gap-2"
      >
        <ProfileTabButton
          active={tab === "ratings"}
          icon={Star}
          label="Оценки"
          count={user.stats.count}
          onClick={() => setTab("ratings")}
        />
        <ProfileTabButton
          active={tab === "wants"}
          icon={BookmarkPlus}
          label="Хочу сыграть"
          count={user.wants}
          onClick={() => setTab("wants")}
        />
      </div>

      {tab === "ratings" ? (
        <>
      {/* Distribution chart */}
      {user.stats.count > 0 && (
        <section
          aria-label="Распределение оценок"
          className="mt-4 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Star className="h-4 w-4 text-primary" aria-hidden />
            Распределение оценок
          </h2>
          <div className="flex h-28 items-end gap-1.5">
            {distribution.map((count, digit) => {
              const active = filter === digit;
              return (
                <button
                  key={digit}
                  type="button"
                  onClick={() => setFilter(active ? "all" : digit)}
                  aria-label={`Оценка ${digit}: ${count} ${pluralRu(count, "игра", "игры", "игр")} — фильтровать`}
                  aria-pressed={active}
                  className="group flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1"
                >
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-bold tabular-nums",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  )}
                  <span
                    className={cn(
                      "animate-grow-up w-full rounded-t-md transition-colors",
                      active
                        ? "bg-primary"
                        : "bg-primary/30 group-hover:bg-primary/55",
                    )}
                    style={{
                      height:
                        count === 0
                          ? "3px"
                          : `${Math.max(8, (count / maxCount) * 100)}%`,
                    }}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-bold tabular-nums",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {digit}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter chips */}
      {user.stats.count > 0 && (
        <section
          aria-label="Фильтр по оценке"
          className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1"
        >
          <FilterChip
            active={filter === "all"}
            label="Все"
            count={user.stats.count}
            onClick={() => setFilter("all")}
          />
          {distribution.map((count, digit) => (
            <FilterChip
              key={digit}
              active={filter === digit}
              label={String(digit)}
              count={count}
              disabled={count === 0}
              onClick={() => setFilter(digit)}
            />
          ))}
        </section>
      )}

      {/* Sorting */}
      {user.stats.count > 0 && (
        <section
          aria-label="Сортировка оценок"
          className="no-scrollbar mt-4 flex items-center gap-2 overflow-x-auto pb-1"
        >
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Сортировка:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <SortPill
              key={opt.key}
              active={sort === opt.key}
              icon={opt.icon}
              label={opt.label}
              onClick={() => setSort(opt.key)}
            />
          ))}
        </section>
      )}

      {/* Ratings list */}
      <section aria-label="Оценки пользователя" className="mt-4">
        {sorted.length === 0 ? (
          <EmptyState
            icon={Gamepad2}
            title={
              user.stats.count === 0
                ? isMe
                  ? "Вы пока ничего не оценили"
                  : `${user.username} пока ничего не оценил`
                : "Нет игр с такой оценкой"
            }
            hint={
              user.stats.count === 0
                ? "Найдите игру через поиск и нажмите на звёздочку!"
                : undefined
            }
            action={
              user.stats.count === 0 ? (
                <Button asChild size="sm">
                  <a href="#/">К поиску игр</a>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
            {sorted.map((r) => (
              <li key={r.gameId}>
                <div className="group/list -mx-2 flex flex-col rounded-xl px-2 py-3 transition-colors hover:bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <a
                      href={`#/game/${r.gameId}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                      aria-label={`Открыть игру ${r.gameName}`}
                    >
                      <GameCover
                        cover={r.gameCover}
                        gameId={r.gameId}
                        name={r.gameName}
                        preferHeader
                        className="aspect-[16/9] w-[78px] shrink-0 rounded border border-border/60 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold transition-colors group-hover/list:text-primary">
                          {r.gameName}
                        </p>
                        <p
                          className="mt-0.5 text-xs text-muted-foreground"
                          title={formatDateTime(r.updatedAt)}
                        >
                          {timeAgo(r.updatedAt)}
                        </p>
                        {r.review && (
                          <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-foreground/70">
                            «{r.review}»
                          </p>
                        )}
                      </div>
                    </a>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <ScoreBadge score={r.score} size="md" />
                      {isMe && (
                        <a
                          href={`#/game/${r.gameId}?rate=1`}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground/80 transition-colors hover:bg-secondary/50 hover:text-primary"
                          aria-label={`Изменить оценку игры ${r.gameName}`}
                          title="Изменить оценку"
                        >
                          <PenLine className="h-3 w-3" aria-hidden />
                          изменить
                        </a>
                      )}
                    </div>
                  </div>
                  {r.review && (
                    <ReviewActions
                      gameId={r.gameId}
                      targetUsername={user.username}
                      likeCount={r.likeCount ?? 0}
                      likedByMe={r.likedByMe ?? false}
                      commentCount={r.commentCount ?? 0}
                      className="mt-0"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ratings.length > 20 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Показаны все оценки — {ratings.length} {pluralRu(ratings.length, "штука", "штуки", "штук")}.
        </p>
      )}
        </>
      ) : (
        /* ---- Wants list ---- */
        <section aria-label="Хочу сыграть" className="mt-4">
          {wants.length === 0 ? (
            <EmptyState
              icon={BookmarkPlus}
              title={
                isMe
                  ? "Список «Хочу сыграть» пуст"
                  : `${user.username} пока не отметил ни одной игры`
              }
              hint={
                isMe
                  ? "На странице игры нажмите «Хочу сыграть» — игра появится здесь."
                  : undefined
              }
              action={
                isMe ? (
                  <Button asChild size="sm">
                    <a href="#/">Найти игру</a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              {wants.map((w) => (
                <li key={w.gameId}>
                  <a
                    href={`#/game/${w.gameId}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <GameCover
                      cover={w.gameCover}
                      gameId={w.gameId}
                      name={w.gameName}
                      preferHeader
                      className="aspect-[16/9] w-[78px] shrink-0 rounded border border-border/60 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{w.gameName}</p>
                      <p
                        className="mt-0.5 text-xs text-muted-foreground"
                        title={formatDateTime(w.updatedAt)}
                      >
                        добавлено {timeAgo(w.updatedAt)}
                      </p>
                    </div>
                    <BookmarkPlus
                      className="h-4 w-4 shrink-0 text-primary/60"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
        </>
      )}
    </div>
  );
}

type SortKey = "new" | "old" | "best" | "worst";

/* ==================== Вкладка «Друзья» ==================== */

/** Вкладка «Друзья» в своём профиле: карточки подписок (референс v3,
 *  friend-grid) + их недавняя активность (лента оценок и отзывов —
 *  реальный /api/feed). */
function ProfileFriendsTab({
  following,
  loading,
  error,
  onRetry,
}: {
  following: Array<{ username: string; avatarUrl: string | null }>;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-5">
      <section aria-label="Мои друзья">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Твой круг</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Посмотри, что друзьям понравилось, прочитай отзыв и выбери, что
              попробовать самому.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-1 text-[9px] text-muted-foreground">
            <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-[var(--good)]" />
            Личный круг
          </span>
        </div>
        {loading ? (
          <ListSkeleton count={3} />
        ) : error ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/40 p-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Повторить
            </Button>
          </div>
        ) : following.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Вы ещё ни на кого не подписаны"
            hint="Найдите друзей поиском на главной (по никнейму) или загляните в блок «Оценки сообщества» на странице любой игры."
          />
        ) : (
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {following.map((f) => (
              <li
                key={f.username}
                className="lift rounded-lg border border-border bg-card p-3.5 hover:border-[var(--line-strong)]"
              >
                <a
                  href={`#/u/${f.username}`}
                  className="flex min-w-0 items-center gap-2.5"
                  aria-label={`Профиль ${f.username}`}
                >
                  <UserAvatar username={f.username} src={f.avatarUrl} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold transition-colors hover:text-primary">
                      {f.username}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      ваша подписка
                    </span>
                  </span>
                </a>
                <div className="mt-3 border-t border-border pt-3">
                  <FollowButton
                    username={f.username}
                    initialFollowing={true}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Активность друзей" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">Недавние события</h2>
          <p className="text-xs text-muted-foreground">
            новые оценки, отзывы и подборки друзей
          </p>
        </div>
        <FriendsFeed />
      </section>
    </div>
  );
}

const SORT_OPTIONS: Array<{
  key: SortKey;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
}> = [
  { key: "new", label: "Сначала новые", icon: Clock3 },
  { key: "old", label: "Сначала старые", icon: History },
  { key: "best", label: "Высокие оценки", icon: TrendingUp },
  { key: "worst", label: "Низкие оценки", icon: TrendingDown },
];

function SortPill({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.97]",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function ProfileTabButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.98]",
        active
          ? "border-primary/50 bg-[var(--primary-soft)] text-primary"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10px] font-extrabold tabular-nums",
          active ? "bg-primary/20" : "bg-secondary",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Карточка статистики (референс v3, profile-stat): крупное число,
 *  мелкая подпись, тихая иконка; числа «накручиваются» при появлении. */
function StatCard({
  label,
  value,
  icon: Icon,
  href,
  ariaLabel,
  plain,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  href?: string;
  ariaLabel?: string;
  /** Без анимации счётчика (например, для нецелых средних). */
  plain?: boolean;
}) {
  const numeric = Number(value.replace(",", "."));
  const countable = !plain && Number.isFinite(numeric) && numeric > 0;
  const animated = useCountUp(countable ? Math.round(numeric) : 0);
  const display = countable ? String(animated) : value;

  const body = (
    <>
      <Icon
        className="absolute right-3 top-3 h-4 w-4 text-primary/40"
        aria-hidden
      />
      <p className="text-[22px] font-bold leading-tight tabular-nums text-primary">
        {display}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </>
  );
  const base =
    "lift relative rounded-lg border border-border bg-background/40 p-3.5 hover:border-[var(--line-strong)]";
  if (href) {
    return (
      <a href={href} aria-label={ariaLabel ?? label} className={base}>
        {body}
      </a>
    );
  }
  return <div className={base}>{body}</div>;
}

function FilterChip({
  active,
  label,
  count,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:border-border",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] tabular-nums",
          active ? "bg-primary/20" : "bg-secondary",
        )}
      >
        {count}
      </span>
    </button>
  );
}
