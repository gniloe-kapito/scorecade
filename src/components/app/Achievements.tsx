"use client";

import { useMemo } from "react";
import {
  BookmarkPlus,
  CalendarClock,
  Gamepad2,
  Heart,
  PenLine,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ProfileUser } from "@/lib/types";
import { pluralRu } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One step on an achievement track (unlocked when value >= at). */
interface AchLevel {
  at: number;
  title: string;
}

interface AchTrack {
  key: string;
  icon: LucideIcon;
  /** What is being counted, e.g. «Оценки игр». */
  label: string;
  /** Plural forms for the counter (value shown as «N оценок»). */
  unit: [string, string, string];
  value: number;
  levels: AchLevel[];
}

/** Arcade-flavoured profile achievements — computed from public profile
 *  stats, no extra API needed. Shown on every profile (own and others'). */
export function Achievements({ user }: { user: ProfileUser }) {
  const tracks = useMemo<AchTrack[]>(() => {
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000),
    );
    return [
      {
        key: "ratings",
        icon: Gamepad2,
        label: "Оценки игр",
        unit: ["оценка", "оценки", "оценок"],
        value: user.stats.count,
        levels: [
          { at: 1, title: "Новичок аркады" },
          { at: 10, title: "Активный игрок" },
          { at: 25, title: "Хардкорщик" },
          { at: 50, title: "Легенда аркады" },
        ],
      },
      {
        key: "reviews",
        icon: PenLine,
        label: "Отзывы",
        unit: ["отзыв", "отзыва", "отзывов"],
        value: user.reviews,
        levels: [
          { at: 1, title: "Первое слово" },
          { at: 5, title: "Обозреватель" },
          { at: 15, title: "Главный критик" },
        ],
      },
      {
        key: "likes",
        icon: Heart,
        label: "Лайки за отзывы",
        unit: ["лайк", "лайка", "лайков"],
        value: user.likesReceived,
        levels: [
          { at: 1, title: "Первый лайк" },
          { at: 10, title: "Любимец публики" },
          { at: 50, title: "Звезда экранов" },
        ],
      },
      {
        key: "followers",
        icon: Users,
        label: "Подписчики",
        unit: ["подписчик", "подписчика", "подписчиков"],
        value: user.followers,
        levels: [
          { at: 1, title: "Первый фанат" },
          { at: 5, title: "Заметный игрок" },
          { at: 25, title: "Инфлюенсер" },
        ],
      },
      {
        key: "wants",
        icon: BookmarkPlus,
        label: "Хочу поиграть",
        unit: ["игра", "игры", "игр"],
        value: user.wants,
        levels: [
          { at: 5, title: "Составил список" },
          { at: 20, title: "Коллекционер" },
        ],
      },
      {
        key: "tens",
        icon: Trophy,
        label: "Оценки «10»",
        unit: ["десятка", "десятки", "десяток"],
        value: user.stats.distribution[10] ?? 0,
        levels: [
          { at: 1, title: "Перфекционист" },
          { at: 5, title: "Вершина вкуса" },
        ],
      },
      {
        key: "days",
        icon: CalendarClock,
        label: "Дней на сайте",
        unit: ["день", "дня", "дней"],
        value: days,
        levels: [
          { at: 7, title: "Завсегдатай" },
          { at: 90, title: "Ветеран аркады" },
        ],
      },
    ];
  }, [user]);

  const unlockedTotal = tracks.reduce(
    (acc, t) => acc + t.levels.filter((l) => t.value >= l.at).length,
    0,
  );
  const levelsTotal = tracks.reduce((acc, t) => acc + t.levels.length, 0);

  return (
    <section
      aria-label="Достижения профиля"
      className="mt-4 rounded-2xl border border-border/70 bg-card/70 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
          <Trophy className="h-4 w-4 text-primary" aria-hidden />
          Достижения
        </h2>
        <span
          className="rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary"
          aria-label={`Открыто ${unlockedTotal} из ${levelsTotal} достижений`}
        >
          {unlockedTotal}/{levelsTotal}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tracks.map((t, i) => {
          const curIdx = t.levels.reduce(
            (acc, l, idx) => (t.value >= l.at ? idx : acc),
            -1,
          );
          const next = t.levels[curIdx + 1];
          const unlocked = curIdx >= 0;
          const curAt = unlocked ? t.levels[curIdx].at : 0;
          const progress = next
            ? Math.min(
                1,
                Math.max(0, (t.value - curAt) / (next.at - curAt)),
              )
            : 1;

          return (
            <li
              key={t.key}
              aria-label={
                unlocked
                  ? `Достижение «${t.levels[curIdx].title}»: ${pluralRu(t.value, t.unit[0], t.unit[1], t.unit[2])}, ${next ? `до «${next.title}» — ${next.at}` : "максимальный уровень"}`
                  : `Достижение «${t.label}» не открыто: нужно ${pluralRu(t.levels[0].at, t.unit[0], t.unit[1], t.unit[2])}, сейчас ${t.value}`
              }
              className={cn(
                "animate-badge-shine rounded-xl border p-2.5 transition-colors",
                unlocked
                  ? "border-primary/30 bg-primary/[0.06]"
                  : "border-border/60 bg-secondary/20",
              )}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    unlocked
                      ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_12px_-4px_var(--primary)]"
                      : "border-border/60 bg-secondary/40 text-muted-foreground/40",
                  )}
                >
                  <t.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-xs font-bold leading-tight",
                      unlocked ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {unlocked ? t.levels[curIdx].title : t.label}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] tabular-nums text-muted-foreground/80">
                    {next
                      ? `${t.value}/${next.at} ${pluralRu(next.at, t.unit[0], t.unit[1], t.unit[2])}`
                      : `${pluralRu(t.value, t.unit[0], t.unit[1], t.unit[2])} · максимум`}
                  </p>
                </div>
              </div>

              {/* Progress to the next level (full bar when maxed out) */}
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
                role="presentation"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    unlocked ? "bg-primary" : "bg-primary/35",
                  )}
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
