"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  KeyRound,
  Loader2,
  LogIn,
  Palette,
  PenLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api, ApiError, setToken } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { SITE_NAME } from "@/lib/config";
import { THEMES, useAppTheme, type ThemeId } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/** #/settings — настройки профиля: акцентная тема (доступна всем),
 *  смена никнейма и смена пароля (только для вошедших). */
export function SettingsView() {
  const { user, ready } = useAuth();

  useEffect(() => {
    document.title = `Настройки — ${SITE_NAME}`;
  }, []);

  return (
    <div className="py-6 md:py-10">
      <section className="mb-7 text-center md:text-left">
        <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">Настройки</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:mx-0">
          Тема оформления, никнейм и пароль. Всё остальное (аватар, баннер,
          оценки) меняется прямо в{" "}
          <a href="#/me" className="font-semibold text-primary hover:underline">
            вашем профиле
          </a>
          .
        </p>
      </section>

      <div className="space-y-6">
        <ThemeSection />

        {ready && !user ? (
          <section className="rounded-xl border border-border bg-card p-6 text-center">
            <LogIn className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <h2 className="mt-3 text-lg font-extrabold">
              Смена никнейма и пароля
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Эти настройки доступны после входа в аккаунт. Тему оформления
              можно выбирать и без аккаунта — она сохраняется в браузере.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild>
                <a href="#/login?from=%23/settings">Войти</a>
              </Button>
              <Button asChild variant="secondary">
                <a href="#/register">Создать аккаунт</a>
              </Button>
            </div>
          </section>
        ) : ready && user ? (
          <>
            <UsernameSection />
            <PasswordSection />
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ==================== Тема ==================== */

function ThemeSection() {
  const [theme, chooseTheme] = useAppTheme();

  return (
    <section
      aria-label="Тема оформления"
      className="rounded-xl border border-border bg-card p-5 md:p-6"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Palette className="h-5 w-5 text-primary" aria-hidden />
        Тема оформления
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Четыре спокойные темы и шесть живых — с анимированным фоном, который
        движется всё время (аврора, угли, сакура, океан, неон, космос).
        Переключение меняет всё приложение; выбор сохраняется в этом браузере
        и восстанавливается при входе.
      </p>
      <div
        role="group"
        aria-label="Выбор темы"
        className="mt-5 flex flex-col gap-2"
      >
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => chooseTheme(t.id as ThemeId)}
              className={cn(
                "grid grid-cols-[72px_minmax(0,1fr)_20px] items-center gap-3.5 rounded-lg border p-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-[var(--primary-soft)]"
                  : "border-border bg-background hover:border-[var(--line-strong)]",
              )}
            >
              <span
                aria-hidden
                className="flex h-9 items-end gap-1 rounded border border-black/10 p-1.5"
                style={{ background: t.swatch.bg }}
              >
                <span
                  className="h-3.5 flex-1 rounded-sm"
                  style={{ background: t.swatch.accent }}
                />
                <span
                  className="h-3.5 flex-1 rounded-sm"
                  style={{ background: t.swatch.panel }}
                />
                <span
                  className="h-3.5 flex-1 rounded-sm"
                  style={{ background: t.swatch.line }}
                />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{t.label}</span>
                  {t.animated && (
                    <span className="rounded-full border border-primary/40 bg-primary/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-primary">
                      живая
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {t.hint}
                </span>
              </span>
              {active ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <span aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ==================== Смена никнейма ==================== */

function UsernameSection() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setUsername(user.username);
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
      toast.error("Никнейм: 3–20 символов, только латиница, цифры и «_».");
      return;
    }
    if (name === user.username) {
      toast.error("Это ваш текущий никнейм — введите новый.");
      return;
    }
    if (password.length < 8) {
      toast.error("Подтвердите смену текущим паролем (не короче 8 символов).");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ user: AuthUser }>("/api/me", {
        method: "PATCH",
        body: { username: name, currentPassword: password },
      });
      updateUser(data.user);
      queryClient.invalidateQueries();
      toast.success(`Никнейм изменён: теперь вы ${data.user.username}`);
      setPassword("");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось изменить никнейм.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Смена никнейма"
      className="rounded-xl border border-border bg-card p-5 md:p-6"
    >
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <PenLine className="h-5 w-5 text-primary" aria-hidden />
        Смена никнейма
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Ник — это адрес вашего профиля (#/u/…). Изменение подтверждается
        текущим паролем: почты у нас нет, и это единственная защита от
        переименования чужими руками.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-username">Новый никнейм</Label>
          <Input
            id="settings-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="например, steam_fan_2024"
            autoComplete="off"
            maxLength={20}
            required
          />
          <p className="text-xs text-muted-foreground">
            3–20 символов: латиница, цифры и «_».
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-username-password">Текущий пароль</Label>
          <Input
            id="settings-username-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Сохраняем…
            </>
          ) : (
            <>
              <UserRound className="h-4 w-4" aria-hidden />
              Сменить никнейм
            </>
          )}
        </Button>
      </form>
    </section>
  );
}

/* ==================== Смена пароля ==================== */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentPassword.length < 8 || newPassword.length < 8) {
      toast.error("Пароли должны быть не короче 8 символов.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Новый пароль совпадает с текущим.");
      return;
    }
    if (newPassword !== repeatPassword) {
      toast.error("Новый пароль и повтор не совпадают.");
      return;
    }
    setBusy(true);
    try {
      // После смены пароля бэкенд аннулирует все прежние сессии и
      // выдаёт новый токен для этого устройства — сохраняем его, чтобы
      // пользователь не вылетел из аккаунта прямо здесь.
      const res = await api<{ ok: boolean; token: string }>(
        "/api/me/password",
        {
          method: "POST",
          body: { currentPassword, newPassword },
        },
      );
      if (res.token) setToken(res.token);
      toast.success(
        "Пароль изменён. На других устройствах придётся войти заново.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось изменить пароль.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Смена пароля"
      className="rounded-xl border border-border bg-card p-5 md:p-6"
    >
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <KeyRound className="h-5 w-5 text-primary" aria-hidden />
        Смена пароля
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Восстановления по почте у нас нет — пароль храните надёжно. Новый пароль
        хэшируется свежей солью; вход на этом устройстве сохраняется, а на
        остальных устройствах придётся войти заново.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-password-current">Текущий пароль</Label>
          <Input
            id="settings-password-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-password-new">Новый пароль</Label>
            <Input
              id="settings-password-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="минимум 8 символов"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-password-repeat">Повторите новый</Label>
            <Input
              id="settings-password-repeat"
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder="ещё раз"
              autoComplete="new-password"
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Сохраняем…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Сменить пароль
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
