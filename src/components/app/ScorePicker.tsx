"use client";

import { cn } from "@/lib/utils";

/** Выбор оценки 1–10 отдельными кнопками (модалка игры + страница игры).
 *  Клик по уже выбранной цифре её снимает (возврат к «не оценено» — но
 *  снятие оценки делается отдельной кнопкой удаления, поэтому здесь клик
 *  по активной цифре просто оставляет её). */
export function ScorePicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Оценка от 1 до 10"
      className={cn("grid grid-cols-10 gap-1.5", className)}
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
            onClick={() => onChange(n)}
            className={cn(
              "h-10 rounded-md border text-sm font-bold tabular-nums transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-[var(--input)] bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
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
