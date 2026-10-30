import {
  DraftEvent,
  DraftEventSchema,
  TranscriptionDraft,
  TranscriptionDraftSchema,
  Uncertainty,
} from '@gsc/contracts';
import { validateEvents } from '@gsc/music-domain';
import {
  AiProvider,
  InterpretTabInput,
  RawInterpretResult,
} from './ai-provider';
import { disagreements } from './consensus';
import { IMAGE_QUALITIES, ImageQuality } from './draft-wire-schema';
import { AiError } from './errors';
import { withAiTimeout } from './with-timeout';

export interface InterpretTabResult {
  draft: TranscriptionDraft;
  provider: string;
  model: string;
  usage?: RawInterpretResult['usage'];
  rejectedEventCount: number;
}

export const DEFAULT_AI_TIMEOUT_MS = 60_000;
/** Independent readings per image; disagreements are flagged for review. */
export const DEFAULT_AI_PASSES = 2;
/**
 * A draft where more than this share of notes needs review is refused as
 * unreadable, even if the model called the image readable.
 */
export const MAX_REVIEW_SHARE = 0.5;
/** Below this many notes, the review share is too noisy to judge by. */
export const MIN_EVENTS_FOR_REVIEW_SHARE = 6;

/**
 * Runs a provider and turns its raw output into a safe draft:
 * schema-validated, impossible events removed (and explained), and rhythm
 * never invented. With passes > 1 the image is read several times in
 * parallel; the first valid reading is returned, with columns the others
 * disagree on flagged as uncertainties. Throws AiError when no pass
 * produced a usable draft, or ai_image_unreadable when the image is too
 * unclear for the draft to be worth correcting.
 */
export async function interpretTab(
  provider: AiProvider,
  input: Omit<InterpretTabInput, 'signal'>,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS,
  passes = 1,
): Promise<InterpretTabResult> {
  const settled = await Promise.allSettled(
    Array.from({ length: Math.max(1, passes) }, () =>
      withAiTimeout(timeoutMs, (signal) =>
        provider.interpretTab({ ...input, signal }),
      ).then((raw) => ({ raw, ...toDraft(raw, input.tuningMidi.length) })),
    ),
  );

  const readings = settled.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  );
  // Every pass failed; each rejection is already an AiError.
  if (readings.length === 0) throw (settled[0] as PromiseRejectedResult).reason;

  const [first, ...others] = readings;
  first.draft.uncertainties.push(
    ...disagreements(
      first.draft.events,
      others.map((r) => r.draft.events),
    ),
  );
  const usages = readings.flatMap((r) => (r.raw.usage ? [r.raw.usage] : []));
  const usage = usages.length
    ? {
        inputTokens: usages.reduce((n, u) => n + u.inputTokens, 0),
        outputTokens: usages.reduce((n, u) => n + u.outputTokens, 0),
      }
    : undefined;

  const unreadable = unreadableReason(readings, first.draft);
  if (unreadable !== null)
    throw new AiError('ai_image_unreadable', unreadable, { usage });

  const poor = readings.find((r) => r.quality.verdict === 'poor');
  if (poor)
    first.draft.uncertainties.unshift({
      eventIds: [],
      reason: `Image quality is poor${poor.quality.reason ? `: ${poor.quality.reason}` : '.'}`,
    });

  return {
    draft: first.draft,
    provider: provider.name,
    model: first.raw.model,
    usage,
    rejectedEventCount: first.rejectedEventCount,
  };
}

interface QualityVerdict {
  verdict: ImageQuality;
  reason: string | null;
}

/**
 * Why the image can't be read, or null when the draft is worth showing. Any
 * reading the model calls unreadable refuses the draft, and so does a draft
 * where most notes are low-confidence or disputed between readings: in
 * practice that means a blurry photo, and correcting it costs more than
 * entering the notes by hand.
 */
function unreadableReason(
  readings: readonly { quality: QualityVerdict }[],
  draft: TranscriptionDraft,
): string | null {
  const refused = readings.find((r) => r.quality.verdict === 'unreadable');
  if (refused)
    return (
      refused.quality.reason ??
      'The AI could not read the tablature in this image reliably.'
    );

  const total = draft.events.length;
  if (total < MIN_EVENTS_FOR_REVIEW_SHARE) return null;
  const flagged = new Set([
    ...draft.uncertainties.flatMap((u) => u.eventIds),
    ...draft.events.filter((e) => e.confidence < 0.6).map((e) => e.id),
  ]);
  return flagged.size / total > MAX_REVIEW_SHARE
    ? `${flagged.size} of ${total} recognized notes were uncertain or read differently on a second look.`
    : null;
}

/** The model's image-quality verdict; absent (older providers, fakes) means clear. */
function readQuality(raw: unknown): QualityVerdict {
  const r = (raw ?? {}) as {
    imageQuality?: unknown;
    imageQualityReason?: unknown;
  };
  const verdict = IMAGE_QUALITIES.find((q) => q === r.imageQuality) ?? 'clear';
  const reason =
    typeof r.imageQualityReason === 'string' && r.imageQualityReason.trim()
      ? r.imageQualityReason.trim().slice(0, 300)
      : null;
  return { verdict, reason };
}

/** Validates one provider reading into a draft, or throws ai_invalid_output. */
function toDraft(
  raw: RawInterpretResult,
  stringCount: number,
): {
  draft: TranscriptionDraft;
  rejectedEventCount: number;
  quality: QualityVerdict;
} {
  const { draft: screened, dropped } = screenEvents(raw.draft);
  const parsed = TranscriptionDraftSchema.safeParse(screened);
  if (!parsed.success) {
    throw new AiError(
      'ai_invalid_output',
      'AI provider returned output that does not match the transcription schema',
      {
        cause: parsed.error,
      },
    );
  }

  parsed.data.uncertainties.push(...dropped);
  const { draft, rejectedEventCount } = sanitizeDraft(parsed.data, stringCount);
  return {
    draft,
    rejectedEventCount: rejectedEventCount + dropped.length,
    quality: readQuality(raw.draft),
  };
}

/**
 * Removes individually malformed events (e.g. fret 31) before whole-draft
 * parsing, so one bad reading doesn't discard every good one.
 */
function screenEvents(raw: unknown): {
  draft: unknown;
  dropped: Uncertainty[];
} {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as { events?: unknown }).events)
  )
    return { draft: raw, dropped: [] };
  const dropped: Uncertainty[] = [];
  const events = (raw as { events: unknown[] }).events.filter((e) => {
    const r = DraftEventSchema.safeParse(e);
    if (!r.success) {
      const issue = r.error.issues[0];
      dropped.push({
        eventIds: [],
        reason: `Removed a recognized note: invalid ${issue?.path.join('.') || 'event'} (${issue?.message ?? 'malformed'})`,
      });
    }
    return r.success;
  });
  return { draft: { ...(raw as object), events }, dropped };
}

/** Drops events that fail deterministic checks and normalizes rhythm. */
export function sanitizeDraft(
  draft: TranscriptionDraft,
  stringCount: number,
): { draft: TranscriptionDraft; rejectedEventCount: number } {
  const uncertainties: Uncertainty[] = [...draft.uncertainties];

  // Rhythm: if any duration is missing, rhythm is unknown for the whole phrase.
  let rhythmKnown = draft.rhythmKnown;
  let events: DraftEvent[] = draft.events;
  if (rhythmKnown && events.some((e) => e.durationTicks === null)) {
    rhythmKnown = false;
    uncertainties.push({
      eventIds: [],
      reason:
        'Rhythm was only partly readable, so all durations were cleared. Add them manually if known.',
    });
  }
  if (!rhythmKnown) events = events.map((e) => ({ ...e, durationTicks: null }));

  // Structural checks that make an event unusable (rhythm already normalized above).
  const fatal = new Set([
    'string-out-of-range',
    'fret-out-of-range',
    'missing-fret',
    'duplicate-id',
  ]);
  const issues = validateEvents(events, {
    stringCount,
    capo: 0,
    rhythmKnown,
  }).filter((i) => i.eventId && fatal.has(i.code));
  const rejected = new Set(issues.map((i) => i.eventId as string));
  for (const issue of issues) {
    uncertainties.push({
      eventIds: [],
      reason: `Removed a recognized note: ${issue.message}`,
    });
  }

  // Repairable inconsistencies are kept but flagged for the user.
  const kept = events.filter((e) => !rejected.has(e.id));
  for (const i of validateEvents(kept, { stringCount, capo: 0, rhythmKnown })) {
    if (i.eventId)
      uncertainties.push({ eventIds: [i.eventId], reason: i.message });
  }

  return {
    draft: {
      ...draft,
      stringCount,
      rhythmKnown,
      events: kept,
      uncertainties: uncertainties.map((u) => ({
        ...u,
        eventIds: u.eventIds.filter((id) => !rejected.has(id)),
      })),
    },
    rejectedEventCount: rejected.size,
  };
}
