"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type { Game } from "@/lib/types";

interface GameCoverProps {
  cover?: string | null;
  header?: string | null;
  gameId?: string | null;
  name: string;
  className?: string;
  /** Для широких слотов (капсулы 16:9): пробуем горизонтальные
   *  варианты обложки раньше вертикальных. */
  preferHeader?: boolean;
}

/** Хосты CDN Steam: сначала cloudflare, затем akamai (у части регионов
 *  файлы отдаёт только один из них). */
const CDN_HOSTS = [
  "https://cdn.cloudflare.steamstatic.com",
  "https://cdn.akamai.steamstatic.com",
] as const;

/** Файлы капсул на CDN: горизонтальные (header/capsule_*) и вертикальная
 *  library-обложка. Порядок зависит от слота (preferHeader). */
const HORIZONTAL_FILES = [
  "header.jpg",
  "capsule_616x353.jpg",
  "capsule_231x87.jpg",
  "capsule_184x69.jpg",
] as const;
const VERTICAL_FILE = "library_600x900.jpg" as const;

function cdnSources(appid: string, preferHeader: boolean): string[] {
  const files = preferHeader
    ? [...HORIZONTAL_FILES, VERTICAL_FILE]
    : [VERTICAL_FILE, ...HORIZONTAL_FILES];
  // Сначала все файлы на cloudflare, затем те же на akamai.
  return CDN_HOSTS.flatMap((host) =>
    files.map((f) => `${host}/steam/apps/${appid}/${f}`),
  );
}

/**
 * Game cover image with a fallback chain:
 * обложка из данных → капсулы CDN (header, capsule_616x353/231x87/184x69,
 * library_600x900; хосты cloudflare и akamai) → карточка игры из
 * /api/games/[id] (там настоящий путь с хешем из appdetails) → буква.
 * Failed URLs are remembered, so the next source is tried automatically.
 */
export function GameCover({
  cover,
  header,
  gameId,
  name,
  className,
  preferHeader = false,
}: GameCoverProps) {
  const appid = gameId?.startsWith("steam:") ? gameId.slice("steam:".length) : null;

  const sources = useMemo(() => {
    const cdn = appid ? cdnSources(appid, preferHeader) : [];
    const list: (string | null | undefined)[] = preferHeader
      ? [header, cover, ...cdn]
      : [cover, header, ...cdn];
    return list.filter((s): s is string => typeof s === "string" && s.length > 0);
  }, [cover, header, appid, preferHeader]);

  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const src = sources.find((s) => !failed.has(s));

  // Последний резерв: все CDN-адреса не ответили, но appid известен —
  // один раз спрашиваем карточку игры у API (там лежит настоящий путь
  // картинки с хешем из appdetails). Ответ кэшируется react-query по
  // ключу ["game", id] — тот же ключ, что использует страница игры.
  const cdnExhausted =
    appid !== null && sources.length > 0 && src === undefined;
  const detailQuery = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => api<Game>(`/api/games/${encodeURIComponent(gameId!)}`),
    enabled: cdnExhausted,
    staleTime: Infinity,
    retry: 0,
  });
  const detail = detailQuery.data;
  const detailSrc = detail
    ? [detail.cover, detail.header].find(
        (s) => typeof s === "string" && s.length > 0 && !failed.has(s),
      )
    : undefined;

  const finalSrc = src ?? detailSrc;

  // Все CDN-варианты исчерпаны, карточка игры ещё грузится — мягкий
  // пульсирующий плейсхолдер вместо мигания буквы-заглушки.
  if (!finalSrc && cdnExhausted && detailQuery.isLoading) {
    return (
      <div
        role="img"
        aria-label={`Обложка игры ${name}`}
        className={cn("animate-pulse bg-secondary", className)}
      />
    );
  }

  if (!finalSrc) {
    return (
      <div
        role="img"
        aria-label={`Обложка игры ${name}`}
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/25 via-card to-secondary",
          className,
        )}
      >
        <span className="text-2xl font-extrabold text-primary/70">
          {(name?.trim()?.[0] ?? "?").toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={`Обложка игры ${name}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() =>
        setFailed((prev) => {
          const next = new Set(prev);
          next.add(finalSrc);
          return next;
        })
      }
      className={cn("bg-secondary object-cover", className)}
    />
  );
}
