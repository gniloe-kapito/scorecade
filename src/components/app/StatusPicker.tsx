"use client";

import { BookmarkPlus, Check, CircleSlash, Flag, Gamepad2, Skull, Trophy } from "lucide-react";
import { STATUS_LABELS, STATUS_ORDER, type GameStatusValue } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Иконки статусов — тихие, штриховые. */
const STATUS_ICONS: Record<GameStatusValue, typeof Flag> = {
  playing: Gamepad2,
  beaten: Trophy,
  dropped: Skull,
  played: Check,
  want: BookmarkPlus,
};

/** Выбор отметки игрока отдельными кнопками: «Играю» / «Пройдена» /
 *  «Брошена» / «Играл(а)» / «Хочу сыграть». Клик по активной отметке или
 *  по «Не отмечена» снимает её (onClear вызывается отдельно, чтобы сайт
 *  игры мог показать подтверждение при существующей оценке). */
export function StatusPicker({
  value,
  onChange,
  onClear,
  disabled = false,
  className,
}: {
  value: GameStatusValue | null;
  onChange: (status: GameStatusValue) => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {STATUS_ORDER.map((s) => {
        const Icon = STATUS_ICONS[s];
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => (active ? onClear() : onChange(s))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-[var(--primary-soft)] text-primary"
                : "border-[var(--input)] bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {STATUS_LABELS[s]}
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={value === null}
        disabled={disabled || value === null}
        onClick={onClear}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
          value === null
            ? "border-[var(--input)] bg-secondary text-foreground"
            : "border-transparent bg-transparent text-muted-foreground/70 hover:border-[var(--input)] hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <CircleSlash className="h-3.5 w-3.5" aria-hidden />
        Не отмечена
      </button>
    </div>
  );
}
