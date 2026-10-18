"use client";

// Действия администратора над пользователем: смена ника, смена пароля
// (в том числе СЕБЕ — без старого пароля), бан/разбан и удаление
// аккаунта. Используется и в панели (#/admin), и в блоке «Админ» на
// странице профиля.
//
// Все опасные действия проходят через AdminConfirmDialog: 10 шагов
// подтверждения с «прыгающей» кнопкой + ввод ника цели (для смены
// ника — ввод НОВОГО ника) на последнем шаге. Запросы идут через
// adminApi (Bearer + короткоживущий X-Admin-Token).

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, KeyRound, Loader2, PenLine, ShieldOff, Trash2 } from "lucide-react";
import { useAdminMode } from "@/lib/admin-context";
import { useAuth } from "@/lib/auth-context";
import { ApiError, setToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

/** Как при регистрации: 3–20 символов, латиница, цифры и «_». */
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function AdminUserActions({
  username,
  isSelf = false,
  targetIsAdmin = false,
  banned = false,
  compact = false,
  /** Вызывается после любого успешного действия (кроме навигаций). */
  onChanged,
  /** Вызывается после удаления аккаунта (например, уйти с профиля). */
  onDeleted,
}: {
  username: string;
  isSelf?: boolean;
  targetIsAdmin?: boolean;
  banned?: boolean;
  compact?: boolean;
  onChanged?: () => void;
  onDeleted?: (username: string) => void;
}) {
  const { adminApi } = useAdminMode();
  const { user: meUser, updateUser } = useAuth();
  const queryClient = useQueryClient();

  // ---- диалоги ----
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameConfirm, setRenameConfirm] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwConfirm, setPwConfirm] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  const [banConfirm, setBanConfirm] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const refresh = () => {
    // Профили, поиск, лента, список админов и список панели — всё,
    // что могло зависеть от ника/оценок/существования пользователя.
    void queryClient.invalidateQueries();
    onChanged?.();
  };

  /** Проверка нового ника перед 10 подтверждениями. */
  const startRename = () => {
    const v = newName.trim();
    if (!USERNAME_RE.test(v)) {
      setNameError("Ник: 3–20 символов, только латиница, цифры и «_».");
      return;
    }
    if (v.toLowerCase() === username.toLowerCase()) {
      setNameError("Это уже текущий ник пользователя.");
      return;
    }
    setNameError(null);
    setRenameOpen(false);
    setRenameConfirm(true);
  };

  const doRename = async () => {
    const res = await adminApi(
      `/api/admin/users/${encodeURIComponent(username)}/rename`,
      { method: "POST", body: { newUsername: newName.trim() } },
    );
    const next = (res as { username?: string }).username ?? newName.trim();
    setRenameConfirm(false);
    toast.success(`Ник изменён: ${username} → ${next}`);
    if (isSelf && meUser) {
      // Контекст авторизации должен узнать новый ник немедленно.
      updateUser({ ...meUser, username: next });
    }
    refresh();
  };

  const openPasswordFlow = () => {
    if (pw1.length < 8 || pw1 !== pw2) {
      setPwError(
        pw1.length < 8
          ? "Пароль должен быть не короче 8 символов."
          : "Пароли не совпадают.",
      );
      return;
    }
    setPwError(null);
    setPwOpen(false);
    setPwConfirm(true);
  };

  const doPassword = async () => {
    const res = await adminApi(
      `/api/admin/users/${encodeURIComponent(username)}/password`,
      { method: "POST", body: { newPassword: pw1 } },
    );
    setPwConfirm(false);
    setPw1("");
    setPw2("");
    // Себе сервер выдал свежий токен взамен отозванных — сохраняем.
    const token = (res as { token?: string }).token;
    if (isSelf && token) setToken(token);
    toast.success(
      isSelf
        ? "Ваш пароль изменён"
        : `Пароль пользователя ${username} изменён`,
    );
    refresh();
  };

  const doBan = async (bannedNext: boolean) => {
    await adminApi(`/api/admin/users/${encodeURIComponent(username)}/ban`, {
      method: "POST",
      body: { banned: bannedNext },
    });
    setBanConfirm(false);
    toast.success(
      bannedNext
        ? `${username} забанен — сессии завершены`
        : `${username} разбанен`,
    );
    refresh();
  };

  const doDelete = async () => {
    await adminApi(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
    setDelConfirm(false);
    toast.success(`Аккаунт ${username} удалён вместе со всеми данными`);
    refresh();
    onDeleted?.(username);
  };

  const btn = (compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs") + " font-bold";
  const icon = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={btn}
          onClick={() => {
            setNewName("");
            setNameError(null);
            setRenameOpen(true);
          }}
          aria-label={compact ? `Сменить ник: ${username}` : undefined}
        >
          <PenLine className={icon} aria-hidden />
          {!compact && "Сменить ник"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={btn}
          onClick={() => {
            setPw1("");
            setPw2("");
            setPwError(null);
            setPwOpen(true);
          }}
          aria-label={compact ? `Сменить пароль: ${username}` : undefined}
        >
          <KeyRound className={icon} aria-hidden />
          {!compact && (isSelf ? "Сменить свой пароль" : "Сменить пароль")}
        </Button>
        {/* Бан и удаление — только для чужих обычных аккаунтов. */}
        {!isSelf && !targetIsAdmin && (
          <>
            {banned ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={btn}
                onClick={() => setBanConfirm(true)}
                title="Разбанить"
                aria-label={compact ? `Разбанить: ${username}` : undefined}
              >
                <ShieldOff className={icon} aria-hidden />
                {!compact && "Разбанить"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={btn}
                onClick={() => setBanConfirm(true)}
                title="Забанить"
                aria-label={compact ? `Забанить: ${username}` : undefined}
              >
                <Ban className={icon} aria-hidden />
                {!compact && "Забанить"}
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={btn}
              onClick={() => setDelConfirm(true)}
              aria-label={compact ? `Удалить аккаунт: ${username}` : undefined}
            >
              <Trash2 className={icon} aria-hidden />
              {!compact && "Удалить аккаунт"}
            </Button>
          </>
        )}
      </div>

      {/* ---- Диалог смены ника ---- */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm border-border bg-card/95">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <PenLine className="h-5 w-5 text-amber-500" aria-hidden />
            Новый ник для {username}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Тот же формат, что при регистрации: 3–20 символов, латиница,
            цифры и «_». Старые ссылки на профиль перестанут открываться
            (оценки и подписки сохранятся).
          </DialogDescription>
          <div className="mt-2 space-y-2">
            <label htmlFor="admin-rename-input" className="sr-only">
              Новый никнейм
            </label>
            <input
              id="admin-rename-input"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20));
                setNameError(null);
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="новый_ник"
              onKeyDown={(e) => {
                if (e.key === "Enter") startRename();
              }}
              className="h-10 w-full rounded-md border border-[var(--input)] bg-background px-3 text-sm outline-none transition-colors focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
            />
            {nameError && (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {nameError}
              </p>
            )}
            <Button
              onClick={startRename}
              disabled={!USERNAME_RE.test(newName.trim())}
              className="h-10 w-full font-bold"
            >
              Продолжить → 10 подтверждений
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Диалог ввода нового пароля ---- */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-sm border-border bg-card/95">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <KeyRound className="h-5 w-5 text-amber-500" aria-hidden />
            {isSelf ? "Свой новый пароль" : `Пароль для ${username}`}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {isSelf
              ? "Старый пароль не нужен — вы уже в админ-режиме (PIN подтверждён). На остальных устройствах придётся войти заново."
              : "Пользователь сможет войти с новым паролем; все его текущие сессии будут завершены."}
          </DialogDescription>
          <div className="mt-2 space-y-2">
            <label htmlFor="admin-pw-1" className="sr-only">
              Новый пароль
            </label>
            <input
              id="admin-pw-1"
              type="password"
              value={pw1}
              onChange={(e) => {
                setPw1(e.target.value);
                setPwError(null);
              }}
              autoComplete="new-password"
              placeholder="Новый пароль (минимум 8 символов)"
              className="h-10 w-full rounded-md border border-[var(--input)] bg-background px-3 text-sm outline-none transition-colors focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
            />
            <label htmlFor="admin-pw-2" className="sr-only">
              Повторите новый пароль
            </label>
            <input
              id="admin-pw-2"
              type="password"
              value={pw2}
              onChange={(e) => {
                setPw2(e.target.value);
                setPwError(null);
              }}
              autoComplete="new-password"
              placeholder="Повторите пароль"
              onKeyDown={(e) => {
                if (e.key === "Enter") openPasswordFlow();
              }}
              className="h-10 w-full rounded-md border border-[var(--input)] bg-background px-3 text-sm outline-none transition-colors focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
            />
            {pwError && (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {pwError}
              </p>
            )}
            <Button
              onClick={openPasswordFlow}
              disabled={pw1.length < 8 || pw1 !== pw2}
              className="h-10 w-full font-bold"
            >
              Продолжить → 10 подтверждений
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- 10 подтверждений ---- */}
      <AdminConfirmDialog
        open={renameConfirm}
        title="Сменить ник пользователю"
        details={[
          `Пользователь: ${username}`,
          `Новый ник: ${newName.trim()}`,
          "Оценки и подписки сохранятся; старые ссылки на профиль перестанут работать.",
        ]}
        finalInput={{
          label: `Введите новый ник без ошибок: ${newName.trim()}`,
          expected: newName.trim(),
        }}
        onConfirm={doRename}
        onCancel={() => setRenameConfirm(false)}
      />

      <AdminConfirmDialog
        open={pwConfirm}
        title={isSelf ? "Сменить свой пароль" : "Сменить пароль пользователю"}
        details={[
          isSelf ? `Свой аккаунт: ${username}` : `Пользователь: ${username}`,
          isSelf
            ? "Остальные ваши устройства выйдут из аккаунта, здесь вход сохранится."
            : "Все его сессии будут завершены, потребуется вход с новым паролем.",
        ]}
        finalInput={{
          label: `Ник аккаунта без ошибок: ${username}`,
          expected: username,
        }}
        onConfirm={doPassword}
        onCancel={() => setPwConfirm(false)}
      />

      <AdminConfirmDialog
        open={banConfirm}
        title={banned ? "Разбанить пользователя" : "Забанить пользователя"}
        details={
          banned
            ? [
                `Пользователь: ${username}`,
                "Он снова сможет войти и пользоваться сайтом.",
              ]
            : [
                `Пользователь: ${username}`,
                "Все его сессии завершатся, вход станет невозможен.",
                "Разбанить можно в любой момент — данные не удаляются.",
              ]
        }
        finalInput={{
          label: `Ник пользователя без ошибок: ${username}`,
          expected: username,
        }}
        onConfirm={() => doBan(!banned)}
        onCancel={() => setBanConfirm(false)}
      />

      <AdminConfirmDialog
        open={delConfirm}
        title="Удалить аккаунт навсегда"
        details={[
          `Пользователь: ${username}`,
          "Удалятся: аккаунт, все оценки и отзывы, комментарии, лайки, подписки, подписчики на него.",
          "Действие НЕОБРАТИМО — восстановить будет нечего.",
        ]}
        finalInput={{
          label: `Ник пользователя без ошибок: ${username}`,
          expected: username,
        }}
        onConfirm={doDelete}
        onCancel={() => setDelConfirm(false)}
      />
    </>
  );
}
