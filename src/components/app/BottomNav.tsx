"use client";

import { Gamepad2, Home, Library, UserRound } from "lucide-react";
import { useHashRoute } from "@/lib/router";
import { cn } from "@/lib/utils";

/** Мобильная нижняя навигация — те же четыре раздела, что в шапке. */
const ITEMS = [
  { href: "#/", label: "Главная", icon: Home, active: (p: string) => p === "/" },
  {
    href: "#/games",
    label: "Каталог",
    icon: Gamepad2,
    active: (p: string) => p.startsWith("/games"),
  },
  {
    href: "#/library",
    label: "Библиотека",
    icon: Library,
    active: (p: string) => p.startsWith("/library"),
  },
  {
    href: "#/me",
    label: "Профиль",
    icon: UserRound,
    active: (p: string) => p.startsWith("/me") || p.startsWith("/u"),
  },
];

export function BottomNav() {
  const route = useHashRoute();
  return (
    <nav
      aria-label="Нижняя навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex w-full">
        {ITEMS.map((item) => {
          const active = item.active(route.path);
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2.5 text-[11px] font-semibold transition-transform active:scale-95",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
