"use client";

// Плашка «Админ-режим включён» — показывается на всех страницах, пока
// активна короткоживущая админ-сессия. Цвет предупреждения (амбер),
// намеренно не зависит от темы. Здесь же — переключатель «Показывать
// значок админа всем» и предупреждение о PIN по умолчанию.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, ShieldCheck, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useAdminMode } from "@/lib/admin-context";
import { useAdmins, type AdminsResponse } from "@/hooks/use-admins";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AdminBar() {
  const { admin, exit, adminApi } = useAdminMode();
  const { badgeVisible } = useAdmins();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [toggling, setToggling] = useState(false);

  // Тикающие часы только для таймера (остальное обновляется само).
  useEffect(() => {
    if (!admin) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [admin]);

  if (!admin) return null;

  const remaining = new Date(admin.expiresAt).getTime() - now;

  const toggleBadge = async (visible: boolean) => {
    setToggling(true);
    try {
      await adminApi("/api/admin/settings", {
        method: "PUT",
        body: { adminBadgeVisible: visible },
      });
      queryClient.setQueryData<AdminsResponse>(["admins"], (old) =>
        old
          ? {
              ...old,
              badgeVisible: visible,
              usernames: visible ? old.usernames : [],
            }
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast(visible ? "Значок админа показывается всем" : "Значок админа скрыт для всех");
    } catch {
      toast.error("Не получилось переключить значок");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      role="status"
      aria-label="Админ-режим включён"
      className="sticky top-0 z-[80] border-b border-amber-500/40 bg-amber-500/95 text-amber-950 shadow-md"
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold sm:text-[13px]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Админ-режим включён
          </span>
          <span
            className={cn(
              "rounded-full bg-amber-950/15 px-2 py-0.5 tabular-nums",
              remaining < 5 * 60 * 1000 && "bg-amber-950/30",
            )}
            title="Время до автоматического выхода"
          >
            осталось {formatRemaining(remaining)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold sm:text-xs">
            <Switch
              checked={badgeVisible}
              disabled={toggling}
              onCheckedChange={(v) => void toggleBadge(v)}
              aria-label="Показывать значок админа всем"
              className="data-[state=checked]:bg-amber-950/70 data-[state=unchecked]:bg-amber-950/30"
            />
            Показывать значок админа всем
          </label>
          <Button
            asChild
            size="sm"
            className="h-7 border-amber-950/30 bg-amber-950/90 px-2.5 text-[11px] font-bold text-amber-50 hover:bg-amber-950"
          >
            <a href="#/admin">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Панель
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => void exit()}
            className="h-7 border-amber-950/30 bg-amber-950/90 px-2.5 text-[11px] font-bold text-amber-50 hover:bg-amber-950"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Выйти
          </Button>
        </div>
      </div>

      {admin.defaultPin && (
        <p className="flex items-center justify-center gap-1.5 border-t border-amber-950/15 bg-amber-400/90 px-4 py-1 text-center text-[11px] font-semibold text-amber-950">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Используется PIN по умолчанию. Задайте секрет ADMIN_PIN
          (<code className="rounded bg-amber-950/15 px-1">npx wrangler secret put ADMIN_PIN</code>)
        </p>
      )}
    </div>
  );
}
