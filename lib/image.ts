/**
 * Photo pipeline.
 *
 * Every picked photo is decoded once and re-encoded into two sizes: a full
 * copy for the detail sheet, and a thumbnail the grid actually renders. That
 * second copy is the important one — a closet of 300 pieces scrolling full-size
 * photos asks the phone to hold ~10 MB of decoded bitmap per visible card,
 * which is how a grid gets janky and then gets killed. The thumbnail costs
 * about a seventh of the bytes and a twentieth of the memory.
 */

const FULL_EDGE = 1400;
const THUMB_EDGE = 512;
const FULL_QUALITY = 0.82;
const THUMB_QUALITY = 0.75;

const IMAGE_EXTENSIONS =
  /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif|tiff?)$/i;

/** Thrown when the browser can't decode the file the user picked. */
export class UnreadablePhotoError extends Error {
  readonly fileName: string;

  constructor(fileName: string) {
    super(
      /\.(heic|heif)$/i.test(fileName)
        ? "This browser can't read iPhone HEIC photos. Add it from your phone, or export it as JPEG first."
        : "That photo couldn't be read. It may be damaged or in a format this browser doesn't support.",
    );
    this.name = "UnreadablePhotoError";
    this.fileName = fileName;
  }
}

/**
 * Whether a picked file is worth trying to decode. Photos exported from an
 * iPhone often arrive with an empty `type`, so an extension is enough to have
 * a go — a file that really isn't an image fails at decode with a clear
 * message, which beats being dropped silently before it is ever opened.
 */
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name);
}

export interface PreparedPhoto {
  full: Blob;
  thumb: Blob;
}

/**
 * The smallest encoder the browser has. WebP is roughly a third smaller than
 * JPEG at matching quality and has been safe everywhere since Safari 14; the
 * JPEG path is the fallback for anything older.
 */
let encoding: "image/webp" | "image/jpeg" | null = null;

function pickEncoding(): "image/webp" | "image/jpeg" {
  if (encoding) return encoding;
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    encoding = probe.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
  } catch {
    encoding = "image/jpeg";
  }
  return encoding;
}

function drawTo(bitmap: ImageBitmap, edge: number): HTMLCanvasElement | null {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, pickEncoding(), quality),
  );
}

/**
 * Decode a picked photo and re-encode it at both sizes.
 *
 * Throws `UnreadablePhotoError` rather than falling back to storing the file
 * as-is: an undecodable original is worse than no photo, because it looks
 * saved on the device that picked it and renders as a broken box everywhere
 * else — an iPhone HEIC saved on her phone would be a hole in the grid on her
 * laptop, discovered weeks later.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnreadablePhotoError(file.name);
  }

  try {
    const fullCanvas = drawTo(bitmap, FULL_EDGE);
    const thumbCanvas = drawTo(bitmap, THUMB_EDGE);
    if (!fullCanvas || !thumbCanvas) throw new UnreadablePhotoError(file.name);

    const [full, thumb] = await Promise.all([
      encode(fullCanvas, FULL_QUALITY),
      encode(thumbCanvas, THUMB_QUALITY),
    ]);
    if (!full || !thumb) throw new UnreadablePhotoError(file.name);

    // Re-encoding a small photo can come out bigger than the original; keep
    // whichever is smaller, as long as the original is something every browser
    // can display.
    const keepOriginal =
      file.size < full.size && /^image\/(jpeg|png|webp)$/.test(file.type);
    return { full: keepOriginal ? file : full, thumb };
  } finally {
    bitmap.close();
  }
}

/**
 * Build a grid-sized copy of a photo already in hand — used when a photo
 * arrives from a backup rather than from the picker, so a restored closet
 * scrolls as cheaply as one built on the device.
 */
export async function thumbnailFrom(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = drawTo(bitmap, THUMB_EDGE);
      return canvas ? await encode(canvas, THUMB_QUALITY) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
