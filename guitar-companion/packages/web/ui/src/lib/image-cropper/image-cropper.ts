import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import {
  drawRotated,
  MAX_TILT,
  NormalizedRect,
  nudgeRect,
  rectFromPoints,
  rotateBy,
  Rotation,
} from '@gsc/web/image-tools';

const DISPLAY_MAX = 1800;
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];

/**
 * Shows a page photo with rotate/straighten/zoom and a drag-to-select
 * passage rectangle (normalized to the rotated image). Keyboard: arrows move
 * the selection, Shift+arrows resize it.
 */
@Component({
  selector: 'gsc-image-cropper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2" data-testid="image-cropper">
      <div
        class="flex flex-wrap items-center gap-2 text-sm"
        role="toolbar"
        aria-label="Image tools"
      >
        <button
          type="button"
          class="tool"
          (click)="rotate(-90)"
          data-testid="rotate-left"
        >
          ⟲ Rotate left
        </button>
        <button
          type="button"
          class="tool"
          (click)="rotate(90)"
          data-testid="rotate-right"
        >
          ⟳ Rotate right
        </button>
        <span class="mx-2 h-5 w-px bg-stone-300"></span>
        <label class="flex items-center gap-2" for="cropper-tilt">
          Straighten
        </label>
        <input
          id="cropper-tilt"
          type="range"
          class="w-32 accent-brand-600"
          [min]="-maxTilt"
          [max]="maxTilt"
          step="0.5"
          [value]="tilt()"
          [attr.aria-valuetext]="tiltLabel()"
          (input)="tilt.set(+$any($event.target).value)"
          (focus)="straightening.set(true)"
          (blur)="straightening.set(false)"
          (pointerenter)="straightening.set(true)"
          (pointerleave)="straightening.set(false)"
          data-testid="tilt"
        />
        <span class="w-12 text-center tabular-nums" data-testid="tilt-level">{{
          tiltLabel()
        }}</span>
        <button
          type="button"
          class="tool"
          [disabled]="tilt() === 0"
          (click)="tilt.set(0)"
          data-testid="tilt-reset"
        >
          Reset
        </button>
        <span class="mx-2 h-5 w-px bg-stone-300"></span>
        <button
          type="button"
          class="tool"
          [disabled]="zoomIndex() === 0"
          (click)="zoomBy(-1)"
          data-testid="zoom-out"
          aria-label="Zoom out"
        >
          −
        </button>
        <span
          class="w-14 text-center tabular-nums"
          data-testid="zoom-level"
          aria-live="polite"
          >{{ zoomPercent() }}%</span
        >
        <button
          type="button"
          class="tool"
          [disabled]="zoomIndex() === zooms.length - 1"
          (click)="zoomBy(1)"
          data-testid="zoom-in"
          aria-label="Zoom in"
        >
          +
        </button>
        <span class="mx-2 h-5 w-px bg-stone-300"></span>
        <button
          type="button"
          class="tool"
          (click)="selection.set({ x: 0, y: 0, width: 1, height: 1 })"
          data-testid="select-all"
        >
          Select all
        </button>
        <button
          type="button"
          class="tool"
          [disabled]="!selection()"
          (click)="selection.set(null)"
          data-testid="clear-selection"
        >
          Clear selection
        </button>
      </div>
      <p class="text-sm text-stone-600">
        Drag over the passage you want. Keep it to a few bars of one tab staff.
        If the page is tilted, use Straighten until the tab lines run level
        with the guides.
      </p>
      <div
        class="max-h-[70vh] overflow-auto rounded border border-stone-300 bg-stone-100"
        data-testid="cropper-viewport"
      >
        <div class="relative select-none" [style.width.%]="zoom() * 100">
          <canvas
            #canvas
            class="block h-auto w-full cursor-crosshair touch-none"
            data-testid="cropper-canvas"
            role="img"
            [attr.aria-label]="
              'Page image, rotated ' + rotation() + ' degrees, straightened ' + tiltLabel()
            "
            (pointerdown)="onDown($event)"
            (pointermove)="onMove($event)"
            (pointerup)="onUp($event)"
            (pointercancel)="dragStart = null"
          ></canvas>
          @if (straightening()) {
            <div
              class="guides pointer-events-none absolute inset-0"
              data-testid="tilt-guides"
            ></div>
          }
          @if (selection(); as s) {
            <div
              class="absolute border-2 border-brand-600 bg-brand-600/10 outline-none focus-visible:ring-4 focus-visible:ring-brand-600/40"
              [style.left.%]="s.x * 100"
              [style.top.%]="s.y * 100"
              [style.width.%]="s.width * 100"
              [style.height.%]="s.height * 100"
              tabindex="0"
              role="region"
              aria-label="Selected passage. Use arrow keys to move, Shift plus arrows to resize."
              data-testid="selection-box"
              (keydown)="onKey($event)"
              (pointerdown)="onDown($event)"
            ></div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .tool {
      border-radius: 0.25rem;
      border: 1px solid var(--color-stone-300);
      background: white;
      padding: 0.25rem 0.5rem;
    }
    .tool:disabled {
      opacity: 0.5;
    }
    .guides {
      background: repeating-linear-gradient(
        to bottom,
        transparent 0 31px,
        rgb(37 99 235 / 0.45) 31px 32px
      );
    }
  `,
})
export class ImageCropperComponent {
  readonly image = input.required<ImageBitmap>();
  readonly rotation = model<Rotation>(0);
  /** Fine straighten angle in degrees (clockwise), within ±MAX_TILT. */
  readonly tilt = model(0);
  readonly selection = model<NormalizedRect | null>(null);

  protected readonly maxTilt = MAX_TILT;
  protected readonly straightening = signal(false);
  protected readonly tiltLabel = computed(() => `${this.tilt()}°`);
  protected readonly zooms = ZOOMS;
  protected readonly zoomIndex = signal(ZOOMS.indexOf(1));
  protected readonly zoom = computed(() => ZOOMS[this.zoomIndex()]);
  protected readonly zoomPercent = computed(() =>
    Math.round(this.zoom() * 100),
  );
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected dragStart: { x: number; y: number } | null = null;

  constructor() {
    effect(() =>
      drawRotated(
        this.canvas().nativeElement,
        this.image(),
        this.rotation(),
        DISPLAY_MAX,
        this.tilt(),
      ),
    );
  }

  protected rotate(delta: 90 | -90): void {
    this.rotation.set(rotateBy(this.rotation(), delta));
    this.selection.set(null);
  }

  protected zoomBy(step: 1 | -1): void {
    this.zoomIndex.set(
      Math.min(ZOOMS.length - 1, Math.max(0, this.zoomIndex() + step)),
    );
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const r = this.canvas().nativeElement.getBoundingClientRect();
    return {
      x: (event.clientX - r.left) / r.width,
      y: (event.clientY - r.top) / r.height,
    };
  }

  protected onDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.canvas().nativeElement.setPointerCapture?.(event.pointerId);
    this.dragStart = this.point(event);
  }

  protected onMove(event: PointerEvent): void {
    if (!this.dragStart) return;
    this.selection.set(rectFromPoints(this.dragStart, this.point(event)));
  }

  protected onUp(event: PointerEvent): void {
    if (!this.dragStart) return;
    const rect = rectFromPoints(this.dragStart, this.point(event));
    this.dragStart = null;
    this.selection.set(rect.width > 0.005 && rect.height > 0.005 ? rect : null);
  }

  protected onKey(event: KeyboardEvent): void {
    const s = this.selection();
    if (!s) return;
    const step = 0.01;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = deltas[event.key];
    if (!d) return;
    event.preventDefault();
    this.selection.set(
      event.shiftKey
        ? nudgeRect(s, { width: d[0], height: d[1] })
        : nudgeRect(s, { x: d[0], y: d[1] }),
    );
  }
}
