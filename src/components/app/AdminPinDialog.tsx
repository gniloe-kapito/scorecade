"use client";

// Диалог входа в админ-режим по PIN (4 символа). Общая часть для
// профиля и панели администратора: сам ввод, лимит длины, ошибка,
// спиннер. Успех — тост, диалог закрывается (сессия — на 30 минут).

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { useAdminMode } from "@/lib/admin-context";
import { ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AdminPinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { enter } = useAdminMode();
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Сброс — при закрытии (любым способом), без эффекта.
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPin("");
      setPinError(null);
    }
    onOpenChange(open);
  };

  const submitPin = async () => {
    if (pinBusy) return;
    setPinBusy(true);
    setPinError(null);
    try {
      await enter(pin);
      handleOpenChange(false);
      setPin("");
      toast("Админ-режим включён — 30 минут");
    } catch (err) {
      setPinError(
        err instanceof ApiError ? err.message : "Не получилось. Попробуйте ещё раз.",
      );
    } finally {
      setPinBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm border-border bg-card/95">
        <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
          <Shield className="h-5 w-5 text-amber-500" aria-hidden />
          Вход в админ-режим
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
          Введите PIN администратора (4 символа). Режим действует 30 минут
          и выключается при перезагрузке страницы.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitPin();
          }}
          className="mt-2 space-y-2"
        >
          <label htmlFor={`admin-pin-input-${open ? "open" : "closed"}`} className="sr-only">
            PIN администратора
          </label>
          <input
            id={`admin-pin-input-${open ? "open" : "closed"}`}
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
              setPinError(null);
            }}
            maxLength={4}
            autoComplete="off"
            inputMode="numeric"
            placeholder="••••"
            autoFocus
            className="h-11 w-full rounded-md border border-[var(--input)] bg-background px-3 text-center text-lg font-extrabold tracking-[0.4em] outline-none transition-colors focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
          />
          {pinError && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {pinError}
            </p>
          )}
          <Button
            type="submit"
            disabled={pin.length !== 4 || pinBusy}
            className="h-10 w-full font-bold"
          >
            {pinBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pinBusy ? "Проверяем…" : "Войти в админ-режим"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
