import { z } from 'zod';

/**
 * Canonical tab representation (docs/DOMAIN_MODEL.md).
 * String index 0 = highest-pitched string. Events sharing an `order`
 * sound together (chords/double-stops). Rhythm may be unknown: then every
 * `durationTicks` is null and nothing may be inferred from spacing.
 */

export const TICKS_PER_QUARTER = 480;
export const MAX_STRINGS = 12;
export const MAX_FRET = 24;

export const TECHNIQUES = [
  'bend',
  'pre-bend',
  'release',
  'slide',
  'hammer-on',
  'pull-off',
  'vibrato',
  'palm-mute',
  'dead-note',
  'ghost',
  'let-ring',
  'tap',
  'harmonic',
] as const;
export const TechniqueSchema = z.enum(TECHNIQUES);
export type Technique = z.infer<typeof TechniqueSchema>;

export const TabEventSchema = z.object({
  id: z.string().min(1).max(64),
  /** Sequence position; equal values are simultaneous. */
  order: z.number().int().min(0).max(10_000),
  stringIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_STRINGS - 1),
  /** Null only for dead notes written as "x". */
  fret: z.number().int().min(0).max(MAX_FRET).nullable(),
  durationTicks: z
    .number()
    .int()
    .positive()
    .max(TICKS_PER_QUARTER * 16)
    .nullable(),
  techniques: z.array(TechniqueSchema).max(TECHNIQUES.length).default([]),
  /** Bend amount in semitones (0.5 = quarter-step written "½", 2 = "full"). */
  bendSemitones: z.number().multipleOf(0.5).min(0.5).max(4).optional(),
});
export type TabEvent = z.infer<typeof TabEventSchema>;

/** Normalized (0..1) region of the submitted crop, for highlighting. */
export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const DraftEventSchema = TabEventSchema.extend({
  confidence: z.number().min(0).max(1),
  box: BoundingBoxSchema.optional(),
});
export type DraftEvent = z.infer<typeof DraftEventSchema>;

export const UncertaintySchema = z.object({
  eventIds: z.array(z.string()).default([]),
  reason: z.string().min(1).max(500),
  box: BoundingBoxSchema.optional(),
});
export type Uncertainty = z.infer<typeof UncertaintySchema>;

/** AI recognition output: a proposal, never canonical (ADR-005). */
export const TranscriptionDraftSchema = z.object({
  stringCount: z.number().int().min(4).max(MAX_STRINGS),
  rhythmKnown: z.boolean(),
  events: z.array(DraftEventSchema).max(256),
  uncertainties: z.array(UncertaintySchema).max(100).default([]),
  detectedSymbols: z.array(z.string().max(80)).max(50).default([]),
  notes: z.string().max(2000).default(''),
});
export type TranscriptionDraft = z.infer<typeof TranscriptionDraftSchema>;
