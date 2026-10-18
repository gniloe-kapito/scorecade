"use client";

import { LogIn, Settings, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useHashRoute, isWideRoute } from "@/lib/router";
import { NotificationsBell } from "./NotificationsBell";
import { UserAvatar } from "./UserAvatar";
import { AdminUsername } from "./AdminUsername";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

/** Основная навигация (референс v3): главная, каталог, библиотека, профиль.
 *  Лента друзей живёт внутри профиля (вкладка «Друзья»), настройки —
 *  шестерёнка справа. Поиск — большой блок на главной странице. */
const NAV_ITEMS = [
  { href: "#/", label: "Главная", active: (p: string) => p === "/" },
  { href: "#/games", label: "Каталог", active: (p: string) => p.startsWith("/games") },
  {
    href: "#/library",
    label: "Библиотека",
    active: (p: string) => p.startsWith("/library"),
  },
  {
    href: "#/me",
    label: "Профиль",
    active: (p: string) => p.startsWith("/me") || p.startsWith("/u"),
  },
];

export function Header() {
  const { user, ready } = useAuth();
  const route = useHashRoute();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex h-14 w-full items-center justify-between gap-2 px-4",
          isWideRoute(route.path) ? "max-w-[1280px]" : "max-w-[900px]",
        )}
      >
        <a href="#/" aria-label="На главную" className="flex shrink-0 items-center gap-2">
          <Wordmark />
        </a>

        <nav
          aria-label="Основная навигация"
          className="no-scrollbar hidden h-full items-center gap-0.5 overflow-x-auto md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.active(route.path);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full items-center border-b-2 px-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {ready && !user && (
            <>
              <Button asChild variant="ghost" size="sm">
                <a href="#/login">
                  <LogIn className="h-4 w-4" aria-hidden />
                  Войти
                </a>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <a href="#/register">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Регистрация
                </a>
              </Button>
            </>
          )}
          {user && <NotificationsBell />}
          <a
            href="#/settings"
            aria-label="Настройки"
            title="Настройки: тема, никнейм, пароль"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </a>
          {user && (
            <a
              href="#/me"
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 transition-colors hover:border-primary/50"
              aria-label={`Профиль ${user.username}`}
            >
              <UserAvatar username={user.username} src={user.avatarUrl} size="sm" />
              <AdminUsername
                username={user.username}
                className="text-sm font-semibold"
                wrapperClassName="hidden max-w-[110px] sm:flex"
              />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
