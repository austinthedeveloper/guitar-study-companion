import {
  fitWithin,
  NormalizedRect,
  Rotation,
  rotatedSize,
  Size,
  toPixelRect,
} from './geometry';
import { isHeic } from './files';

/** Decodes an upload (including iPhone HEIC) into a bitmap with EXIF orientation applied. */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  let blob: Blob = file;
  if (isHeic(file)) {
    // Lazy-loaded: the HEIC decoder (WASM, LGPL) is only fetched when needed.
    const { heicTo } = await import('heic-to');
    blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  }
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

/** Applies the rotation transform so drawing the source at 0,0 lands in rotated space. */
function applyRotation(
  ctx: CanvasRenderingContext2D,
  rotation: Rotation,
  rotated: Size,
): void {
  if (rotation === 90) {
    ctx.translate(rotated.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(rotated.width, rotated.height);
    ctx.rotate(Math.PI);
  } else if (rotation === 270) {
    ctx.translate(0, rotated.height);
    ctx.rotate(-Math.PI / 2);
  }
}

/** Draws the whole rotated image into a canvas scaled to fit maxDim (for display). */
export function drawRotated(
  canvas: HTMLCanvasElement,
  image: ImageBitmap,
  rotation: Rotation,
  maxDim: number,
): Size {
  const rotated = rotatedSize(
    { width: image.width, height: image.height },
    rotation,
  );
  const out = fitWithin(rotated, maxDim);
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return out;
  ctx.save();
  ctx.scale(out.width / rotated.width, out.height / rotated.height);
  applyRotation(ctx, rotation, rotated);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
  return out;
}

export interface CropResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Crops the selection from the rotated image to a JPEG no larger than
 * maxDim on its longest side, lowering quality until under maxBytes.
 */
export async function cropToJpeg(
  image: ImageBitmap,
  rotation: Rotation,
  rect: NormalizedRect,
  options: { maxDim: number; maxBytes: number },
): Promise<CropResult> {
  const rotated = rotatedSize(
    { width: image.width, height: image.height },
    rotation,
  );
  const px = toPixelRect(rect, rotated);
  const out = fitWithin({ width: px.width, height: px.height }, options.maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.scale(out.width / px.width, out.height / px.height);
  ctx.translate(-px.x, -px.y);
  applyRotation(ctx, rotation, rotated);
  ctx.drawImage(image, 0, 0);

  for (const quality of [0.9, 0.8, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (blob && blob.size <= options.maxBytes)
      return { blob, width: out.width, height: out.height };
  }
  throw new Error(
    'The selected area is too large to send. Select a smaller passage.',
  );
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
