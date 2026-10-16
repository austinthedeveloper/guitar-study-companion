export type Rotation = 0 | 90 | 180 | 270;

/** Rectangle as fractions (0..1) of the rotated image. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export function rotateBy(rotation: Rotation, delta: 90 | -90): Rotation {
  return ((((rotation + delta) % 360) + 360) % 360) as Rotation;
}

/** Fine "straighten" adjustment for tilted photos, in degrees either way. */
export const MAX_TILT = 15;

/**
 * Size of the image after a quarter-turn rotation plus an optional tilt
 * (degrees, clockwise). A tilted image grows to its bounding box.
 */
export function rotatedSize(size: Size, rotation: Rotation, tilt = 0): Size {
  const turned =
    rotation === 90 || rotation === 270
      ? { width: size.height, height: size.width }
      : size;
  if (!tilt) return turned;
  const rad = (Math.abs(tilt) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    width: Math.round(turned.width * cos + turned.height * sin),
    height: Math.round(turned.width * sin + turned.height * cos),
  };
}

/** Scales to fit within maxDim on the longest side, never upscaling. */
export function fitWithin(size: Size, maxDim: number): Size {
  const scale = Math.min(1, maxDim / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Builds a normalized rect from two drag points, clamped to the image. */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): NormalizedRect {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  const x2 = clamp01(Math.max(a.x, b.x));
  const y2 = clamp01(Math.max(a.y, b.y));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Moves/resizes a rect by a delta while keeping it inside the image. */
export function nudgeRect(
  rect: NormalizedRect,
  delta: Partial<NormalizedRect>,
  minSize = 0.02,
): NormalizedRect {
  const width = Math.min(1, Math.max(minSize, rect.width + (delta.width ?? 0)));
  const height = Math.min(
    1,
    Math.max(minSize, rect.height + (delta.height ?? 0)),
  );
  const x = Math.min(1 - width, Math.max(0, rect.x + (delta.x ?? 0)));
  const y = Math.min(1 - height, Math.max(0, rect.y + (delta.y ?? 0)));
  return { x, y, width, height };
}

/** Pixel rect (integers) in rotated-image space. */
export function toPixelRect(
  rect: NormalizedRect,
  size: Size,
): { x: number; y: number; width: number; height: number } {
  const x = Math.round(rect.x * size.width);
  const y = Math.round(rect.y * size.height);
  return {
    x,
    y,
    width: Math.max(
      1,
      Math.min(size.width - x, Math.round(rect.width * size.width)),
    ),
    height: Math.max(
      1,
      Math.min(size.height - y, Math.round(rect.height * size.height)),
    ),
  };
}

/** A selection must be large enough to contain readable tab. */
export function isUsableSelection(
  rect: NormalizedRect | null,
  size: Size,
  minPixels = 64,
): boolean {
  if (!rect) return false;
  const px = toPixelRect(rect, size);
  return px.width >= minPixels && px.height >= minPixels / 2;
}
