"use client";

// Ник пользователя с отметкой администратора (красный ник + маленький щит),
// но БЕЗ собственной ссылки — для мест, где ник уже обёрнут ссылкой-карточкой
// (списки подписчиков/подписок, результаты поиска по никнейму, шапка, карточка
// профиля в ховере). Там, где ник — самостоятельная ссылка, используется
// UserLink (он делает ту же отметку на своём якоре).
//
// Один общий запрос /api/admins на страницу (кэш react-query + браузера);
// если значок админа скрыт глобальной настройкой — отметку не видит никто.

import { Shield } from "lucide-react";
import { useAdmins } from "@/hooks/use-admins";
import { cn } from "@/lib/utils";

export function AdminUsername({
  username,
  className,
  wrapperClassName,
}: {
  username: string;
  /** Классы самого ника (вес/размер шрифта; цвет задаёт .admin-name). */
  className?: string;
  /** Классы обёртки имени+щита — обязательно задайте display
   *  (flex / inline-flex / hidden sm:flex …), базовых display-классов нет. */
  wrapperClassName?: string;
}) {
  const { adminNames, badgeVisible } = useAdmins();
  const isAdmin = badgeVisible && adminNames.has(username.toLowerCase());

  return (
    <span className={cn("min-w-0 items-center gap-1", wrapperClassName)}>
      <span className={cn("truncate", isAdmin && "admin-name", className)}>
        {username}
      </span>
      {isAdmin && (
        <Shield
          className="h-3 w-3 shrink-0 text-[var(--admin-red)]"
          aria-label="Администратор"
        >
          <title>Администратор</title>
        </Shield>
      )}
    </span>
  );
}
