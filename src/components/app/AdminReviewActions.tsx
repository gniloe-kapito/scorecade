"use client";

// Кнопки админ-удаления для отзывов и комментариев. Видны только в
// админ-режиме и не показываются на собственных элементах администратора
// (там уже есть обычное удаление). Опасное действие проходит через
// AdminConfirmDialog (10 шагов + ввод ника на последнем).

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldMinus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAdminMode } from "@/lib/admin-context";
import { AdminConfirmDialog } from "@/components/app/AdminConfirmDialog";
import { cn } from "@/lib/utils";

/** Общие стили маленькой красной админ-кнопки. */
const adminBtnClass =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[var(--admin-red)] transition-colors hover:bg-[var(--admin-red)]/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--admin-red)]";

/** «Удалить отзыв (админ)» — удаляет оценку целиком с отзывом,
 *  лайками и комментариями. Рядом с каждым отзывом в профилях и
 *  списках оценок игры. */
export function AdminDeleteReviewButton({
  targetUsername,
  gameId,
  gameName,
  className,
}: {
  targetUsername: string;
  gameId: string;
  gameName: string;
  className?: string;
}) {
  const { user } = useAuth();
  const { admin, adminApi } = useAdminMode();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Кнопка живёт только в админ-режиме и не на своих оценках.
  if (!admin || !user || user.username.toLowerCase() === targetUsername.toLowerCase()) {
    return null;
  }

  const confirm = async () => {
    try {
      await adminApi(
        `/api/admin/ratings/${encodeURIComponent(gameId)}?target=${encodeURIComponent(targetUsername)}`,
        { method: "DELETE" },
      );
      setOpen(false);
      toast.success(`Оценка ${targetUsername} удалена`);
      for (const key of ["profile", "community", "communityTop", "friendsRatings", "feed", "library"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не получилось удалить оценку",
      );
      throw err; // диалог остаётся открытым с сообщением об ошибке
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Удалить отзыв (админ): ${targetUsername} — ${gameName}`}
        title={`Удалить отзыв (админ): ${targetUsername}`}
        className={cn(adminBtnClass, className)}
      >
        <ShieldMinus className="h-3 w-3" aria-hidden />
        Удалить отзыв (админ)
      </button>
      <AdminConfirmDialog
        open={open}
        title="Удалить оценку с отзывом"
        details={[
          `Автор: ${targetUsername}`,
          `Игра: ${gameName}`,
          "Удаляется оценка целиком — вместе с отзывом, лайками и комментариями.",
        ]}
        finalInput={{
          label: `Ник автора отзыва без ошибок: ${targetUsername}`,
          expected: targetUsername,
        }}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/** «Удалить комментарий (админ)» — рядом с каждым комментарием в ветках. */
export function AdminDeleteCommentButton({
  commentId,
  authorUsername,
  textPreview,
  onDeleted,
  className,
}: {
  commentId: number;
  authorUsername: string;
  textPreview: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const { user } = useAuth();
  const { admin, adminApi } = useAdminMode();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  if (!admin || !user || user.username.toLowerCase() === authorUsername.toLowerCase()) {
    return null;
  }

  const confirm = async () => {
    try {
      await adminApi(`/api/admin/comments/${commentId}`, { method: "DELETE" });
      setOpen(false);
      toast.success("Комментарий удалён");
      onDeleted?.();
      for (const key of ["comments", "profile", "community", "feed", "notifications"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не получилось удалить комментарий",
      );
      throw err;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Удалить комментарий (админ): ${authorUsername}`}
        title="Удалить комментарий (админ)"
        className={cn(adminBtnClass, className)}
      >
        <ShieldMinus className="h-3 w-3" aria-hidden />
        Удалить (админ)
      </button>
      <AdminConfirmDialog
        open={open}
        title="Удалить комментарий"
        details={[
          `Автор: ${authorUsername}`,
          `Комментарий: «${textPreview}»`,
          "Удаляется вместе с ответами на него.",
        ]}
        finalInput={{
          label: `Ник автора комментария без ошибок: ${authorUsername}`,
          expected: authorUsername,
        }}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
