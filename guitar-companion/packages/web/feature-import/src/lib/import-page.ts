import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  InterpretResponse,
  MAX_CROP_BYTES,
  MAX_CROP_DIMENSION,
  Uncertainty,
} from '@gsc/contracts';
import { midiToNoteName, validateEvents } from '@gsc/music-domain';
import {
  ClientError,
  Flash,
  HealthApi,
  ImportsApi,
  PhrasesApi,
  toClientError,
} from '@gsc/web/data-access';
import {
  ACCEPT_ATTRIBUTE,
  blobToBase64,
  checkUploadFile,
  cropToJpeg,
  decodeImage,
  isUsableSelection,
  NormalizedRect,
  Rotation,
  rotatedSize,
} from '@gsc/web/image-tools';
import {
  AlertComponent,
  ConsentDialogComponent,
  EditorEvent,
  FileDropComponent,
  ImageCropperComponent,
  SourceFormComponent,
  SourceFormValue,
  StepsComponent,
  TabEditorComponent,
} from '@gsc/web/ui';
import { firstValueFrom } from 'rxjs';

const STEPS = ['Upload', 'Select passage', 'Details', 'Review & correct'];
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic (Claude)',
  fake: 'the test recognizer',
};

interface Crop {
  blob: Blob;
  url: string;
}

@Component({
  selector: 'gsc-import-page',
  imports: [
    AlertComponent,
    ConsentDialogComponent,
    FileDropComponent,
    ImageCropperComponent,
    SourceFormComponent,
    StepsComponent,
    TabEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-page.html',
})
export class ImportPage {
  private readonly imports = inject(ImportsApi);
  private readonly phrases = inject(PhrasesApi);
  private readonly health = inject(HealthApi);
  private readonly router = inject(Router);
  private readonly flash = inject(Flash);

  protected readonly steps = STEPS;
  protected readonly accept = ACCEPT_ATTRIBUTE;
  protected readonly step = signal(0);

  // Step 1: upload
  protected readonly fileName = signal('');
  protected readonly image = signal<ImageBitmap | null>(null);
  protected readonly loadingImage = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  // Step 2: selection
  protected readonly rotation = signal<Rotation>(0);
  protected readonly selection = signal<NormalizedRect | null>(null);
  protected readonly selectionUsable = computed(() => {
    const img = this.image();
    return (
      !!img &&
      isUsableSelection(
        this.selection(),
        rotatedSize({ width: img.width, height: img.height }, this.rotation()),
      )
    );
  });
  protected readonly crop = signal<Crop | null>(null);
  protected readonly cropError = signal<string | null>(null);

  // Step 3: details + recognition
  protected readonly meta = signal<SourceFormValue | null>(null);
  protected readonly metaAttempted = signal(false);
  protected readonly consentOpen = signal(false);
  protected readonly interpreting = signal(false);
  protected readonly interpretError = signal<ClientError | null>(null);
  private readonly providerName = rxResource({
    stream: () => this.health.getHealth(),
  });
  protected readonly providerLabel = computed(() => {
    const name = this.providerName.value()?.checks.aiProvider;
    return (name && PROVIDER_LABELS[name]) || name || 'the AI provider';
  });

  // Step 4: review
  protected readonly title = signal('');
  protected readonly events = signal<EditorEvent[]>([]);
  protected readonly rhythmKnown = signal(false);
  protected readonly recognition = signal<Pick<
    InterpretResponse,
    'provider' | 'model' | 'rejectedEventCount'
  > | null>(null);
  protected readonly uncertainties = signal<Uncertainty[]>([]);
  protected readonly detectedSymbols = signal<string[]>([]);
  protected readonly pendingDraft = signal<InterpretResponse | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<ClientError | null>(null);

  protected readonly stringCount = computed(
    () => this.meta()?.context.tuningMidi.length ?? 6,
  );
  protected readonly stringLabels = computed(() =>
    (this.meta()?.context.tuningMidi ?? [64, 59, 55, 50, 45, 40]).map((m) =>
      midiToNoteName(m).replace(/-?\d+$/, ''),
    ),
  );
  protected readonly issues = computed(() =>
    validateEvents(this.events(), {
      stringCount: this.stringCount(),
      capo: this.meta()?.context.capo ?? 0,
      rhythmKnown: this.rhythmKnown(),
    }),
  );
  protected readonly uncertainIds = computed(() =>
    this.uncertainties().flatMap((u) => u.eventIds),
  );
  protected readonly reviewCount = computed(
    () =>
      new Set([
        ...this.uncertainIds(),
        ...this.events()
          .filter((e) => (e.confidence ?? 1) < 0.6)
          .map((e) => e.id),
      ]).size,
  );
  protected readonly canSave = computed(
    () =>
      !this.saving() &&
      this.events().length > 0 &&
      this.title().trim().length > 0 &&
      this.issues().length === 0 &&
      !!this.meta(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const c = this.crop();
      if (c) URL.revokeObjectURL(c.url);
      this.image()?.close();
    });
  }

  // ---------- step 1 ----------
  protected async onFile(file: File): Promise<void> {
    this.uploadError.set(null);
    const problem = checkUploadFile(file);
    if (problem) {
      this.uploadError.set(problem);
      return;
    }
    this.loadingImage.set(true);
    try {
      const bitmap = await decodeImage(file);
      this.image()?.close();
      this.image.set(bitmap);
      this.fileName.set(file.name);
      this.rotation.set(0);
      this.selection.set(null);
      this.step.set(1);
    } catch {
      this.uploadError.set(
        'Could not read that image. Try a different photo or export it as JPG.',
      );
    } finally {
      this.loadingImage.set(false);
    }
  }

  // ---------- step 2 ----------
  protected async confirmSelection(): Promise<void> {
    const img = this.image();
    const sel = this.selection();
    if (!img || !sel || !this.selectionUsable()) return;
    this.cropError.set(null);
    try {
      const result = await cropToJpeg(img, this.rotation(), sel, {
        maxDim: MAX_CROP_DIMENSION,
        maxBytes: MAX_CROP_BYTES,
      });
      const previous = this.crop();
      if (previous) URL.revokeObjectURL(previous.url);
      this.crop.set({
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
      });
      this.step.set(2);
    } catch (err) {
      this.cropError.set(
        err instanceof Error ? err.message : 'Could not prepare the selection.',
      );
    }
  }

  // ---------- step 3 ----------
  protected requestRecognition(): void {
    this.metaAttempted.set(true);
    if (!this.meta() || !this.crop()) return;
    this.consentOpen.set(true);
  }

  protected async onConsent(): Promise<void> {
    this.consentOpen.set(false);
    const crop = this.crop();
    const meta = this.meta();
    if (!crop || !meta) return;
    this.interpreting.set(true);
    this.interpretError.set(null);
    try {
      const result = await firstValueFrom(
        this.imports.interpret({
          image: {
            mimeType: 'image/jpeg',
            dataBase64: await blobToBase64(crop.blob),
          },
          tuningMidi: meta.context.tuningMidi,
          consent: true,
        }),
      );
      if (this.events().length > 0) {
        // Never silently overwrite the user's corrections.
        this.pendingDraft.set(result);
      } else {
        this.applyDraft(result);
      }
      this.step.set(3);
    } catch (err) {
      this.interpretError.set(toClientError(err));
    } finally {
      this.interpreting.set(false);
    }
  }

  protected enterManually(): void {
    this.metaAttempted.set(true);
    if (!this.meta()) return;
    this.interpretError.set(null);
    this.step.set(3);
  }

  protected applyDraft(result: InterpretResponse): void {
    this.events.set(result.draft.events.map((e) => ({ ...e })));
    this.rhythmKnown.set(result.draft.rhythmKnown);
    this.uncertainties.set(result.draft.uncertainties);
    this.detectedSymbols.set(result.draft.detectedSymbols);
    this.recognition.set({
      provider: result.provider,
      model: result.model,
      rejectedEventCount: result.rejectedEventCount,
    });
    this.pendingDraft.set(null);
    if (!this.title()) {
      const s = this.meta()?.source;
      this.title.set(s?.songTitle ? `${s.songTitle} lick` : '');
    }
  }

  // ---------- step 4 ----------
  protected async save(): Promise<void> {
    const meta = this.meta();
    if (!meta || !this.canSave()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const phrase = await firstValueFrom(
        this.phrases.create({
          title: this.title().trim(),
          source: meta.source,
          context: meta.context,
          rhythmKnown: this.rhythmKnown(),
          ticksPerQuarter: 480,
          events: this.events().map(
            ({
              id,
              order,
              stringIndex,
              fret,
              durationTicks,
              techniques,
              bendSemitones,
            }) => ({
              id,
              order,
              stringIndex,
              fret,
              durationTicks,
              techniques,
              ...(bendSemitones !== undefined ? { bendSemitones } : {}),
            }),
          ),
          draftProvider: this.recognition()?.provider,
        }),
      );
      this.flash.set('phrase-saved');
      await this.router.navigate(['/phrases', phrase.id]);
    } catch (err) {
      this.saveError.set(toClientError(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected goTo(step: number): void {
    if (step < this.step()) this.step.set(step);
  }

  protected startOver(): void {
    this.image()?.close();
    this.image.set(null);
    this.selection.set(null);
    this.events.set([]);
    this.uncertainties.set([]);
    this.recognition.set(null);
    this.pendingDraft.set(null);
    this.interpretError.set(null);
    this.step.set(0);
  }
}
