"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import { Toaster } from "sonner";
import { WifiOff } from "lucide-react";
import { useHashRoute, isWideRoute } from "@/lib/router";
import { useAuth } from "@/lib/auth-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { BackToTop } from "./BackToTop";
import { GameModal } from "./GameModal";
import { AdminBar } from "./AdminBar";
import { ThemeCanvas } from "./ThemeCanvas";
import { closeGameModal } from "./game-modal-store";
import { HomeView } from "./views/HomeView";
import { GameView } from "./views/GameView";
import { CatalogView } from "./views/CatalogView";
import { LibraryView } from "./views/LibraryView";
import { ProfileView } from "./views/ProfileView";
import { FeedView } from "./views/FeedView";
import { LoginView, RegisterView } from "./views/AuthViews";
import { UserListView } from "./views/UserListView";
import { NotificationsView } from "./views/NotificationsView";
import { SettingsView } from "./views/SettingsView";
import { AdminView } from "./views/AdminView";
import { NotFoundView } from "./views/NotFoundView";

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message ?? "Неизвестная ошибка" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-20 text-center">
          <h2 className="text-2xl font-extrabold">Что-то пошло не так</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {this.state.message}
          </p>
          <Button asChild className="mt-6">
            <a href="#/">На главную</a>
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** #/library — моя библиотека: игры с оценками, отметками и отзывами. */
function MyLibraryView() {
  return <LibraryView />;
}

/** #/me — my profile or a login prompt. */
function MeView() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <GameSkeletonBlock />;
  }
  if (!user) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-extrabold">Это ваш профиль</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Но пока вы не вошли в аккаунт. Войдите — и здесь появятся ваши оценки,
          статистика и подписки.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <a href="#/login">Войти</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="#/register">Создать аккаунт</a>
          </Button>
        </div>
      </div>
    );
  }
  return <ProfileView username={user.username} isMe />;
}

/** #/u/<username> — public profile; renders as OWN when the viewer
 *  visits their own profile link (edit controls, export, logout). */
function UserProfileView({ username }: { username: string }) {
  const { user } = useAuth();
  const isMe = !!user && user.username.toLowerCase() === username.toLowerCase();
  return <ProfileView username={username} isMe={isMe} />;
}

function GameSkeletonBlock() {
  return (
    <div className="py-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-4 h-4 w-1/3" />
      <Skeleton className="mt-8 h-40 w-full rounded-2xl" />
    </div>
  );
}

export function App() {
  const route = useHashRoute();
  const online = useOnlineStatus();

  // Позиция прокрутки каталога/библиотеки: если ушли на страницу игры и
  // вернулись «назад» — оказываемся там же, где были, а не в самом верху.
  // Флаг ставится только при уходе со списка на /game/*, поэтому обычный
  // переход из меню по-прежнему открывает список с начала.
  const listScroll = useRef<{ path: string | null; top: number }>({
    path: null,
    top: 0,
  });
  const currentPathRef = useRef(route.path);

  useEffect(() => {
    const prev = currentPathRef.current;
    if (prev === route.path) {
      closeGameModal();
      return;
    }
    currentPathRef.current = route.path;
    closeGameModal();

    const isList = (p: string) => p === "/games" || p === "/library";
    // Уход со списка на страницу игры — запомнить, куда листал пользователь.
    if (isList(prev) && route.path.startsWith("/game/")) {
      listScroll.current = { path: prev, top: window.scrollY };
      window.scrollTo({ top: 0 });
      return;
    }
    // Возврат со страницы игры на список — восстановить позицию.
    if (
      isList(route.path) &&
      prev.startsWith("/game/") &&
      listScroll.current.path === route.path
    ) {
      const top = listScroll.current.top;
      listScroll.current = { path: null, top: 0 };
      // Каталог подтягивается из кэша react-query мгновенно, но кадр на
      // рендер всё равно нужен — иначе прокрутка происходит до того, как
      // восстановится высота страницы.
      requestAnimationFrame(() => {
        window.scrollTo({ top });
        window.setTimeout(() => window.scrollTo({ top }), 80);
      });
      return;
    }
    listScroll.current = { path: null, top: 0 };
    window.scrollTo({ top: 0 });
  }, [route.path]);

  // "/" anywhere (outside a text field) focuses the global search —
  // GitHub-style. Navigates home first when needed, then focuses the input
  // (HomeView gives it id="global-search-input").
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return; // typing in a field — "/" belongs to the text
      }
      e.preventDefault();
      const atHome =
        window.location.hash === "" || window.location.hash === "#/";
      if (!atHome) {
        window.location.hash = "#/";
        // HomeView mounts on the next tick — give it a moment, then focus.
        window.setTimeout(
          () => document.getElementById("global-search-input")?.focus(),
          160,
        );
      } else {
        document.getElementById("global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const seg = route.segments;
  let view: ReactNode;
  let isGame = false;

  if (seg.length === 0) {
    view = <HomeView />;
  } else if (seg[0] === "game" && seg[1]) {
    isGame = true;
    view = <GameView id={seg[1]} />;
  } else if (seg[0] === "games") {
    // Каталог (#/games) — широкая страница, любые вложенные пути игнорируются.
    view = <CatalogView />;
  } else if (seg[0] === "u" && seg[1]) {
    if (seg[2] === "followers" || seg[2] === "following") {
      view = <UserListView username={seg[1]} kind={seg[2]} />;
    } else {
      view = <UserProfileView username={seg[1]} />;
    }
  } else if (seg[0] === "feed") {
    view = <FeedView />;
  } else if (seg[0] === "library") {
    // Библиотека (#/library) — мои игры, оценки и отметки.
    view = <MyLibraryView />;
  } else if (seg[0] === "notifications") {
    view = <NotificationsView />;
  } else if (seg[0] === "me") {
    view = <MeView />;
  } else if (seg[0] === "settings") {
    // Настройки (#/settings): тема, анимация фона, никнейм, пароль.
    view = <SettingsView />;
  } else if (seg[0] === "admin") {
    // Панель администратора (#/admin): пользователи, баны, ники, пароли.
    view = <AdminView />;
  } else if (seg[0] === "login") {
    view = <LoginView from={route.query.get("from")} />;
  } else if (seg[0] === "register") {
    view = <RegisterView from={route.query.get("from")} />;
  } else {
    view = <NotFoundView />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Плашка админ-режима: на всех страницах, сверху (цвет
          предупреждения — не зависит от темы). */}
      <AdminBar />
      {/* Живой фон анимированных тем — под контентом, базовый цвет
          живёт на <html>. Все 11 живых тем рисуются на canvas
          (ThemeCanvas + реестр src/lib/backdrops). */}
      <div className="theme-backdrop" aria-hidden>
        <ThemeCanvas />
      </div>
      {!online && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-2 z-[70] mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-400/50 bg-card/95 px-4 py-2 text-xs font-bold text-amber-600 shadow-lg backdrop-blur dark:border-amber-400/40 dark:text-amber-300"
        >
          <WifiOff className="h-4 w-4" aria-hidden />
          Нет соединения — офлайн-режим
        </div>
      )}
      {!isGame && <Header />}
      <div className="flex-1">
        <main
          className={cn(
            "mx-auto w-full px-4 pb-12",
            isWideRoute(route.path) ? "max-w-[1280px]" : "max-w-[900px]",
          )}
        >
          <div key={route.path} className="animate-view-in">
            <RouteErrorBoundary>{view}</RouteErrorBoundary>
          </div>
        </main>
      </div>
      <Footer />
      <BottomNav />
      <BackToTop />
      <GameModal />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </div>
  );
}
