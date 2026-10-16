import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-7 min-w-7 px-1 text-sm",
  md: "h-9 min-w-9 px-1.5 text-lg",
  lg: "h-12 min-w-12 px-2 text-2xl",
};

/** Kinopoisk-style at-a-glance tone: accent for good, neutral for middling,
 *  muted red for poor — спокойные цвета из текущей темы. */
function toneFor(score: number): string {
  if (score >= 7) {
    return "border-primary/35 bg-primary/15 text-primary";
  }
  if (score >= 4) {
    return "border-border bg-secondary text-foreground";
  }
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

export function ScoreBadge({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      aria-label={`Оценка ${score} из 10`}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-extrabold tabular-nums",
        toneFor(score),
        SIZE_CLASSES[size],
        className,
      )}
    >
      {score}
    </span>
  );
}
