// Client-side profile image processing before upload to kappa.lol.
// Avatars: center-crop to a square + downscale to 256×256.
// Banners: downscale to at most 1600px wide (aspect kept).
// GIFs skip processing (canvas would drop the animation).
// If anything fails or the result is larger than the original, the
// original file is returned untouched.

const AVATAR_SIZE = 256;
const BANNER_MAX_WIDTH = 1600;

export type PictureKind = "avatar" | "banner";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/** Downscale/crop a profile picture in the browser. Returns the original
 *  file when processing is not needed or not possible. */
export async function processProfileImage(
  file: File,
  kind: PictureKind,
): Promise<File> {
  // GIF: keep animation — upload as is.
  if (file.type === "image/gif") return file;

  try {
    const img = await loadImage(file);
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) return file;

    let sx = 0;
    let sy = 0;
    let cropW = sw;
    let cropH = sh;
    let dw: number;
    let dh: number;

    if (kind === "avatar") {
      // Center square crop of the shorter side.
      const side = Math.min(sw, sh);
      sx = Math.round((sw - side) / 2);
      sy = Math.round((sh - side) / 2);
      cropW = side;
      cropH = side;
      dw = Math.min(AVATAR_SIZE, side); // never upscale
      dh = dw;
    } else {
      dw = Math.min(BANNER_MAX_WIDTH, sw); // never upscale
      dh = Math.round(sh * (dw / sw));
    }

    // Nothing to do if the image already fits.
    if (kind === "avatar" && cropW <= AVATAR_SIZE && sw === sh) return file;
    if (kind === "banner" && sw <= BANNER_MAX_WIDTH) return file;

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, dw, dh);

    const type = "image/webp";
    const blob = await canvasToBlob(canvas, type, 0.92);
    // Some old browsers can't encode WebP — try JPEG as a fallback.
    const finalBlob =
      blob && blob.type === "image/webp"
        ? blob
        : await canvasToBlob(canvas, "image/jpeg", 0.92);
    if (!finalBlob || finalBlob.size >= file.size) return file;

    const ext = finalBlob.type === "image/webp" ? ".webp" : ".jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "picture";
    return new File([finalBlob], `${base}${ext}`, { type: finalBlob.type });
  } catch {
    return file; // exotic format / decode error — let the server decide
  }
}
