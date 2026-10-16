"use client";

import { GameCover } from "@/components/app/GameCover";
import { gameModalClickHandler } from "@/components/app/game-modal-store";
import { formatAverage, pluralRu } from "@/lib/format";
import { STATUS_LABELS, type BrowseItem, type GameStatusValue } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Карточка игры с капсульной обложкой (референс v3): обложка 460×215,
 *  название, оценка Scorecade, цена/скидка и моя отметка. Клик открывает
 *  компактное окно игры; ссылка ведёт на полную страницу (cmd/ctrl-клик и
 *  средняя кнопка работают как обычно). */
export function GameCard({
  item,
  myStatus = null,
  className,
}: {
  item: BrowseItem;
  /** Моя отметка (из кэша статусов) — бейдж в углу карточки. */
  myStatus?: GameStatusValue | null;
  className?: string;
}) {
  return (
    <a
      href={`#/game/${item.id}`}
      onClick={gameModalClickHandler(item.id)}
      aria-label={`${item.name} — открыть окно игры`}
      className={cn(
        "group lift flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card hover:border-[var(--line-strong)]",
        className,
      )}
    >
      <div className="relative aspect-[460/215] overflow-hidden bg-secondary">
        <GameCover
          cover={item.cover}
          header={item.header}
          gameId={item.id}
          name={item.name}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        {item.rank !== null && (
          <span
            aria-hidden
            className="absolute left-1.5 top-1.5 rounded border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white"
          >
            {item.rank}
          </span>
        )}
        {/* Скидка — бейдж на капсуле; «Бесплатно» не дублируем: цена
            в нижней строке карточки уже говорит об этом. */}
        {item.discountPercent !== null && (
          <span className="absolute right-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground">
            −{item.discountPercent}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] font-bold leading-snug">
            {item.name}
          </p>
          {item.scorecade ? (
            <span
              className="shrink-0 text-xs font-extrabold tabular-nums text-primary"
              title={`${item.scorecade.count} ${pluralRu(item.scorecade.count, "оценка", "оценки", "оценок")} Scorecade`}
            >
              {formatAverage(item.scorecade.average)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 min-h-[15px] truncate text-[11px] leading-snug text-muted-foreground">
          {item.reviewSummary ?? item.released}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {item.priceInitial ? (
              <>
                <s className="opacity-70">{item.priceInitial}</s>{" "}
                <span className="font-bold text-primary">{item.price}</span>
              </>
            ) : item.price ? (
              item.price
            ) : (
              "—"
            )}
          </span>
          {myStatus ? (
            <span className="shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {STATUS_LABELS[myStatus]}
            </span>
          ) : item.scorecade ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {item.scorecade.count}{" "}
              {pluralRu(item.scorecade.count, "оценка", "оценки", "оценок")}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

/** Мини-карточка «моя игра» для превью библиотеки на главной и профиле
 *  (референс v3, mini-game): горизонтальная капсула 16:9, название,
 *  оценка/отметка. Клик — компактное окно игры. */
export function LibraryMiniCard({
  gameId,
  gameName,
  gameCover,
  score,
  status,
}: {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  score: number | null;
  status: GameStatusValue | null;
}) {
  return (
    <a
      href={`#/game/${gameId}`}
      onClick={gameModalClickHandler(gameId)}
      aria-label={`${gameName} — открыть окно игры`}
      className="group lift block min-w-0"
    >
      <div className="overflow-hidden rounded-md border border-border bg-card group-hover:border-[var(--line-strong)]">
        <GameCover
          cover={gameCover}
          gameId={gameId}
          name={gameName}
          preferHeader
          className="aspect-[16/9] w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
        />
      </div>
      <p className="mt-1.5 truncate text-[11px] font-bold leading-snug">
        {gameName}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-muted-foreground">
        {score !== null ? (
          <span className="font-extrabold text-primary">{score}/10</span>
        ) : null}
        {status ? <span className="truncate">{STATUS_LABELS[status]}</span> : null}
      </p>
    </a>
  );
}
