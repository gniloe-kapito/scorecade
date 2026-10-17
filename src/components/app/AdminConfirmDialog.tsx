"use client";

// Диалог подтверждения опасных админ-действий: 10 шагов, чтобы исключить
// промах кликом. На каждом шаге кнопка «Подтверждаю» меняет место
// (слева / по центру / справа, по кругу), счётчик шагов виден, «Отмена»
// всегда доступна и сбрасывает всё. На 10-м шаге нужно дополнительно
// вписать ник цели или слово «УДАЛИТЬ» — запрос уходит только после него.

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ADMIN_CONFIRM_STEPS } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Позиция кнопки «Подтверждаю» на текущем шаге (по кругу). */
function confirmSlot(step: number): "left" | "center" | "right" {
  return (["left", "center", "right"] as const)[step % 3];
}

export function AdminConfirmDialog({
  open,
  title,
  details,
  /** Что вписать на 10-м шаге: { label, expected } — ник автора или слово. */
  finalInput,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** Строки описания: что именно будет сделано и с кем. */
  details: string[];
  /** Требование 10-го шага: подпись поля и ожидаемый текст (ник/«УДАЛИТЬ»). */
  finalInput: { label: string; expected: string };
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Сброс состояния при каждом открытии/закрытии.
  useEffect(() => {
    if (open) {
      setStep(1);
      setInput("");
      setBusy(false);
    }
  }, [open]);

  const isLast = step >= ADMIN_CONFIRM_STEPS;
  const inputOk =
    input.trim().toLowerCase() === finalInput.expected.trim().toLowerCase();

  const cancel = () => {
    if (busy) return; // запрос уже ушёл — ждём
    setStep(1);
    setInput("");
    onCancel();
  };

  const confirm = async () => {
    if (busy) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    if (!inputOk) return;
    setBusy(true);
    try {
      await onConfirm();
      // Успех: родитель закрывает диалог (open=false) — состояние сбросится.
    } finally {
      setBusy(false);
    }
  };

  const slot = confirmSlot(step);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
      <DialogContent className="max-w-md border-amber-500/40 bg-card/95 p-4 sm:p-5">
        <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          {title}
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
          Опасное действие админ-режима. {details.join(" · ")}
        </DialogDescription>

        <ul className="mt-1 space-y-0.5">
          {details.map((d) => (
            <li
              key={d}
              className="rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-xs font-semibold"
            >
              {d}
            </li>
          ))}
        </ul>

        {/* Прогресс 10 шагов */}
        <div className="mt-3" aria-live="polite">
          <p className="text-center text-sm font-extrabold text-amber-500">
            Подтверждение {step} из {ADMIN_CONFIRM_STEPS}
          </p>
          <div className="mt-1.5 flex justify-center gap-1">
            {Array.from({ length: ADMIN_CONFIRM_STEPS }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "h-1.5 w-4 rounded-full",
                  i < step ? "bg-amber-500" : "bg-secondary",
                )}
              />
            ))}
          </div>
        </div>

        {/* 10-й шаг: ввод ника цели / слова «УДАЛИТЬ» */}
        {isLast && (
          <div className="animate-fade-in mt-3">
            <label
              htmlFor="admin-confirm-input"
              className="text-xs font-semibold leading-relaxed text-foreground/85"
            >
              {finalInput.label}
            </label>
            <input
              id="admin-confirm-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="mt-1 h-10 w-full rounded-md border border-[var(--input)] bg-background px-3 text-sm outline-none transition-colors focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
            />
            {!inputOk && input.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Точно введите «{finalInput.expected}», чтобы продолжить.
              </p>
            )}
          </div>
        )}

        {/* Кнопки: «Подтверждаю» меняет позицию по кругу */}
        <div
          className={cn(
            "mt-4 flex items-center gap-2",
            slot === "left" && "justify-start",
            slot === "center" && "justify-center",
            slot === "right" && "justify-end",
          )}
        >
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirm()}
            disabled={busy || (isLast && !inputOk)}
            className="h-10 font-extrabold"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {busy ? "Выполняем…" : "Подтверждаю"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={cancel}
            disabled={busy}
            className="h-10"
          >
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
