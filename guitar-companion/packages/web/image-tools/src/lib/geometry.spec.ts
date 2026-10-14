import {
  fitWithin,
  isUsableSelection,
  nudgeRect,
  rectFromPoints,
  rotateBy,
  rotatedSize,
  toPixelRect,
} from './geometry';

describe('geometry', () => {
  it('rotates in 90° steps and wraps', () => {
    expect(rotateBy(0, 90)).toBe(90);
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(0, -90)).toBe(270);
  });

  it('swaps dimensions for quarter turns', () => {
    expect(rotatedSize({ width: 3024, height: 4032 }, 90)).toEqual({
      width: 4032,
      height: 3024,
    });
    expect(rotatedSize({ width: 3024, height: 4032 }, 180)).toEqual({
      width: 3024,
      height: 4032,
    });
  });

  it('fits within a max dimension without upscaling', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 2048)).toEqual({
      width: 2048,
      height: 1536,
    });
    expect(fitWithin({ width: 800, height: 600 }, 2048)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('builds clamped rects from drag points in any direction', () => {
    expect(rectFromPoints({ x: 0.8, y: 0.6 }, { x: 0.2, y: 0.1 })).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.6000000000000001,
      height: 0.5,
    });
    expect(rectFromPoints({ x: -1, y: 0.5 }, { x: 2, y: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      width: 1,
      height: 0,
    });
  });

  it('nudges within bounds and enforces a minimum size', () => {
    expect(
      nudgeRect({ x: 0.9, y: 0, width: 0.1, height: 0.1 }, { x: 0.5 }),
    ).toEqual({ x: 0.9, y: 0, width: 0.1, height: 0.1 });
    expect(
      nudgeRect({ x: 0.1, y: 0.1, width: 0.05, height: 0.05 }, { width: -1 })
        .width,
    ).toBe(0.02);
  });

  it('converts to integer pixels inside the image', () => {
    expect(
      toPixelRect(
        { x: 0.5, y: 0.5, width: 0.6, height: 0.6 },
        { width: 1000, height: 500 },
      ),
    ).toEqual({ x: 500, y: 250, width: 500, height: 250 });
  });

  it('rejects tiny selections', () => {
    expect(isUsableSelection(null, { width: 1000, height: 1000 })).toBe(false);
    expect(
      isUsableSelection(
        { x: 0, y: 0, width: 0.01, height: 0.5 },
        { width: 1000, height: 1000 },
      ),
    ).toBe(false);
    expect(
      isUsableSelection(
        { x: 0, y: 0, width: 0.5, height: 0.1 },
        { width: 1000, height: 1000 },
      ),
    ).toBe(true);
  });
});
