import { SITE_NAME } from "@/lib/config";
import { isWideRoute, useHashRoute } from "@/lib/router";
import { cn } from "@/lib/utils";

export function Footer() {
  const route = useHashRoute();
  return (
    <footer className="mt-auto border-t border-border/60 bg-card/40">
      {/* Как в референсе: знак + название слева, атрибуция справа.
          pb keeps the fixed mobile bottom nav from covering the text. */}
      <div
        className={cn(
          "mx-auto flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 pb-[calc(env(safe-area-inset-bottom)+68px)] pt-3 md:pb-4",
          isWideRoute(route.path) ? "max-w-[1280px]" : "max-w-[900px]",
        )}
      >
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="brand-mark !h-5 !w-5 !text-[12px]">
            S
          </span>
          <span className="text-[11px] font-extrabold tracking-[0.11em] text-muted-foreground">
            {SITE_NAME.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            Игры · Оценки · Свой круг
          </span>
        </span>
        <p className="text-[10px] leading-snug text-muted-foreground/80">
          Данные об играх — Steam. Проект не связан с Valve · Некоммерческий
          проект · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
