"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Тип загружаемого фото профиля. */
export type PictureKind = "avatar" | "banner";

/** Размеры вывода: аватар — квадрат 256, баннер — широкая полоса 1600×320. */
const OUTPUT: Record<PictureKind, { w: number; h: number }> = {
  avatar: { w: 256, h: 256 },
  banner: { w: 1600, h: 320 },
};
/** Отображаемая ширина рамки кропа (высота — по пропорции вывода). */
const FRAME_WIDTH = 340;
/** Максимальный зум (× от «вписать и покрыть»). */
const MAX_ZOOM: Record<PictureKind, number> = { avatar: 3, banner: 2.5 };

interface CropState {
  natW: number;
  natH: number;
  /** Отображаемый масштаб = coverScale × zoom. */
  zoom: number;
  /** Смещение центра картинки от центра рамки, px. */
  ox: number;
  oy: number;
}

/**
 * Диалог обрезки фото профиля: картинку можно двигать пальцем/мышью и
 * приближать ползунком — рамка показывает ровно то, что будет сохранено
 * (аватар — квадрат, баннер — широкая полоса). Вырезанный фрагмент
 * отрисовывается на canvas и уходит на сервер как готовый файл.
 */
export function ImageCropDialog({
  open,
  file,
  kind,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  file: File | null;
  kind: PictureKind;
  busy: boolean;
  /** Готовый (вырезанный и пережатый) файл — можно загружать. */
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Загрузка файла → object URL → натуральные размеры.
  useEffect(() => {
    if (!open || !file) {
      setUrl(null);
      setCrop(null);
      setError(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const img = new Image();
    img.onload = () => {
      setCrop({
        natW: img.naturalWidth,
        natH: img.naturalHeight,
        zoom: 1,
        ox: 0,
        oy: 0,
      });
    };
    img.onerror = () => setError("Не удалось прочитать изображение.");
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [open, file]);

  const out = OUTPUT[kind];
  // Рамка: ширина фиксированная, высота — по пропорции вывода.
  const frameW = FRAME_WIDTH;
  const frameH = Math.round((FRAME_WIDTH * out.h) / out.w);

  const coverScale = crop
    ? Math.max(frameW / crop.natW, frameH / crop.natH)
    : 1;
  const scale = coverScale * (crop?.zoom ?? 1);

  /** Пределы смещения: картинка всегда покрывает рамку целиком. */
  const clamp = useCallback(
    (state: CropState): CropState => {
      const s = Math.max(frameW / state.natW, frameH / state.natH) * state.zoom;
      const maxX = Math.max(0, (state.natW * s - frameW) / 2);
      const maxY = Math.max(0, (state.natH * s - frameH) / 2);
      return {
        ...state,
        ox: Math.min(maxX, Math.max(-maxX, state.ox)),
        oy: Math.min(maxY, Math.max(-maxY, state.oy)),
      };
    },
    [frameW, frameH],
  );

  // ---- перетаскивание картинки (мышь и тач) ----
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: crop.ox, oy: crop.oy };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !crop) return;
    setCrop(
      clamp({
        ...crop,
        ox: d.ox + (e.clientX - d.px),
        oy: d.oy + (e.clientY - d.py),
      }),
    );
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // Клавиатура: стрелки двигают картинку (Shift — мелкий шаг).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!crop) return;
    const step = e.shiftKey ? 2 : 12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setCrop(clamp({ ...crop, ox: crop.ox + m[0], oy: crop.oy + m[1] }));
  };

  const setZoom = (zoom: number) => {
    if (!crop) return;
    setCrop(clamp({ ...crop, zoom }));
  };

  // ---- вырезание: видимая область рамки → canvas → File ----
  const confirm = async () => {
    if (!crop || !url) return;
    setError(null);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode"));
        el.src = url;
      });

      // Видимая область в натуральных координатах картинки.
      const cropW = frameW / scale;
      const cropH = frameH / scale;
      const cropX = crop.natW / 2 - crop.ox / scale - cropW / 2;
      const cropY = crop.natH / 2 - crop.oy / scale - cropH / 2;

      const canvas = document.createElement("canvas");
      canvas.width = out.w;
      canvas.height = out.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, out.w, out.h);

      const toBlob = (type: string, q: number) =>
        new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), type, q),
        );
      let blob = await toBlob("image/webp", 0.92);
      if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.92);
      if (!blob) throw new Error("encode");

      const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
      const base = (file?.name ?? "picture").replace(/\.[^.]+$/, "");
      onConfirm(
        new File([blob], `${base}${ext}`, { type: blob.type }),
      );
    } catch {
      setError("Не удалось обработать изображение. Попробуйте другой файл.");
    }
  };

  const kindLabel = kind === "avatar" ? "аватарки" : "баннера";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="top-[50%] max-h-[92vh] gap-0 overflow-y-auto rounded-xl border-border bg-card p-0 sm:max-w-[440px]"
      >
        <div className="p-4 sm:p-5">
          <DialogTitle className="text-base font-bold">
            Кадрирование {kindLabel}
          </DialogTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Тяните картинку, чтобы выбрать часть, и меняйте масштаб ползунком.
            Рамка показывает результат точно.
          </p>

          {/* Рамка кропа */}
          <div className="mt-4 flex justify-center">
            <div
              ref={frameRef}
              role="application"
              aria-label={`Область кадрирования ${kindLabel}: перетаскивайте картинку`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ width: frameW, height: frameH, touchAction: "none" }}
              className="relative cursor-grab overflow-hidden rounded-lg border border-[var(--line-strong)] bg-secondary outline-none transition-[border-color] focus-visible:border-primary active:cursor-grabbing"
            >
              {url ? (
                <img
                  src={url}
                  alt="Загруженное изображение — двигайте, чтобы выбрать область"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    transform: `translate(calc(-50% + ${(crop?.ox ?? 0)}px), calc(-50% + ${
                      crop?.oy ?? 0
                    }px)) scale(${scale})`,
                    transformOrigin: "center",
                    visibility: crop ? "visible" : "hidden",
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              )}
              {/* Сетка третей — помогает компоновать кадр */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-foreground/10" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-foreground/10" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-foreground/10" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-foreground/10" />
              </div>
            </div>
          </div>

          {/* Ползунок масштаба */}
          <div className="mt-4">
            <label
              htmlFor="crop-zoom"
              className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground"
            >
              Масштаб
              <span className="tabular-nums">{Math.round(scale / coverScale * 100)}%</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => crop && setCrop(clamp({ ...crop, zoom: 1, ox: 0, oy: 0 }))}
                disabled={!crop || busy}
                aria-label="Сбросить положение и масштаб"
                title="Сбросить"
                className="btn btn-quiet btn-tiny shrink-0 !px-2"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              </button>
              <input
                id="crop-zoom"
                type="range"
                min={1}
                max={MAX_ZOOM[kind]}
                step={0.01}
                value={crop?.zoom ?? 1}
                disabled={!crop || busy}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-[var(--primary)]"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {error}
            </p>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Сохранится {out.w}×{out.h}
            {kind === "banner" ? " — широкая полоса, как в шапке профиля" : " — квадрат"}.
          </p>

          {/* Действия */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-quiet"
              onClick={onCancel}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void confirm()}
              disabled={!crop || busy}
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Загружаем…
                </>
              ) : (
                "Сохранить"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
