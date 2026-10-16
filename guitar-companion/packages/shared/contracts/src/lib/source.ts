import { z } from 'zod';
import { MAX_FRET, MAX_STRINGS } from './tab';

export const SourceReferenceSchema = z.object({
  bookTitle: z.string().trim().min(1).max(200),
  page: z.string().trim().max(20).optional(),
  songTitle: z.string().trim().max(200).optional(),
  author: z.string().trim().max(200).optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

/** From this column (event order) on, the phrase is over this chord. */
export const ChordChangeSchema = z.object({
  fromOrder: z.number().int().min(0).max(10_000),
  chord: z.string().trim().min(1).max(40),
});
export type ChordChange = z.infer<typeof ChordChangeSchema>;

export const ChordChangesSchema = z
  .array(ChordChangeSchema)
  .max(64)
  .refine(
    (changes) =>
      new Set(changes.map((c) => c.fromOrder)).size === changes.length,
    'Only one chord can start at each note.',
  );

export const MusicalContextSchema = z.object({
  /** One MIDI pitch per string, index 0 = highest string. */
  tuningMidi: z.array(z.number().int().min(0).max(127)).min(4).max(MAX_STRINGS),
  capo: z.number().int().min(0).max(MAX_FRET).default(0),
  key: z.string().trim().max(20).optional(),
  /** Free-text chord context, e.g. "G D/F# Em C" (structured in M2). */
  chords: z.string().trim().max(500).optional(),
  /** User-placed chords; absent means placement is unknown. */
  chordChanges: ChordChangesSchema.optional(),
  tempoBpm: z.number().int().min(20).max(400).optional(),
});
export type MusicalContext = z.infer<typeof MusicalContextSchema>;

/**
 * Replaces a phrase's harmonic assumptions. `revision` must match the stored
 * phrase so an edit made from a stale page is rejected, not lost.
 */
export const UpdateHarmonyRequestSchema = z.object({
  revision: z.number().int().min(1),
  key: z.string().trim().max(20).optional(),
  chords: z.string().trim().max(500).optional(),
  chordChanges: ChordChangesSchema.default([]),
});
export type UpdateHarmonyRequest = z.infer<typeof UpdateHarmonyRequestSchema>;
