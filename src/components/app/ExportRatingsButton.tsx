"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SITE_NAME } from "@/lib/config";
import { pluralRu } from "@/lib/format";
import type { RatingRow } from "@/lib/types";

/** Trigger a client-side file download for the given content. */
function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before freeing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC 4180 CSV field escaping (quotes and commas inside values). */
function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** «Экспорт» — download my ratings as JSON (backups) or CSV (Excel-friendly,
 *  UTF-8 BOM included so Cyrillic opens correctly). Client-side only —
 *  the profile data is already loaded. */
export function ExportRatingsButton({
  username,
  ratings,
}: {
  username: string;
  ratings: RatingRow[];
}) {
  const [open, setOpen] = useState(false);
  if (ratings.length === 0) return null;

  const exportJson = () => {
    setOpen(false);
    const payload = {
      site: SITE_NAME,
      username,
      exportedAt: new Date().toISOString(),
      count: ratings.length,
      ratings: ratings.map((r) => ({
        gameId: r.gameId,
        gameName: r.gameName,
        score: r.score,
        review: r.review,
        updatedAt: r.updatedAt,
      })),
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `${username}-scorecade.json`,
      "application/json",
    );
    toast.success(
      `JSON сохранён — ${pluralRu(ratings.length, "оценка", "оценки", "оценок")}`,
    );
  };

  const exportCsv = () => {
    setOpen(false);
    const header = "gameId,gameName,score,review,updatedAt";
    const lines = ratings.map((r) =>
      [
        csvField(r.gameId),
        csvField(r.gameName),
        String(r.score),
        csvField(r.review ?? ""),
        r.updatedAt,
      ].join(","),
    );
    // BOM so Excel detects UTF-8 and shows Cyrillic game names correctly.
    downloadFile(
      `\uFEFF${header}\n${lines.join("\n")}`,
      `${username}-scorecade.csv`,
      "text/csv",
    );
    toast.success(
      `CSV сохранён — ${pluralRu(ratings.length, "оценка", "оценки", "оценок")}`,
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Скачать мои оценки (JSON или CSV)"
          aria-expanded={open}
        >
          <Download className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Экспорт</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Мои оценки · {ratings.length}
        </p>
        <button
          type="button"
          onClick={exportJson}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <FileJson className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight">JSON</span>
            <span className="block text-xs text-muted-foreground">
              для бэкапов и переноса
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight">CSV</span>
            <span className="block text-xs text-muted-foreground">
              для Excel и таблиц
            </span>
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
